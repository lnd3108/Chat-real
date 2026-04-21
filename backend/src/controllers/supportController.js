import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { APP_ROLES } from "../constants/rbac.js";
import { emitToUser } from "../socket/index.js";
import { emitSupportConversationRealtime } from "../services/supportRealtimeService.js";

const SUPPORT_STATUS_OPEN_SET = ["open", "in_progress"];

const populateSupportConversation = async (conversation) => {
  await conversation.populate([
    {
      path: "participants.userId",
      select: "displayName userName avatarUrl role email",
    },
    {
      path: "supportCreatedByUserId",
      select: "displayName userName avatarUrl email role",
    },
    {
      path: "assignedAdminId",
      select: "displayName userName avatarUrl email role",
    },
  ]);

  return conversation;
};

const formatSupportParticipants = (participants = []) =>
  participants.map((participant) => ({
    _id: participant.userId?._id ?? participant.userId ?? null,
    userName: participant.userId?.userName ?? null,
    displayName: participant.userId?.displayName ?? null,
    avatarUrl: participant.userId?.avatarUrl ?? null,
    role: participant.userId?.role ?? null,
    email: participant.userId?.email ?? null,
    joinedAt: participant.joinedAt,
  }));

const toPlainUnreadCounts = (unreadCounts) =>
  unreadCounts instanceof Map ? Object.fromEntries(unreadCounts) : unreadCounts || {};

const formatSupportConversation = (conversation) => {
  const plainConversation =
    typeof conversation.toObject === "function" ? conversation.toObject() : conversation;

  return {
    ...plainConversation,
    participants: formatSupportParticipants(plainConversation.participants),
    supportCreatedByUser:
      plainConversation.supportCreatedByUserId &&
      typeof plainConversation.supportCreatedByUserId === "object"
        ? plainConversation.supportCreatedByUserId
        : null,
    assignedAdmin:
      plainConversation.assignedAdminId && typeof plainConversation.assignedAdminId === "object"
        ? plainConversation.assignedAdminId
        : null,
    unreadCounts: toPlainUnreadCounts(plainConversation.unreadCounts),
  };
};

const buildSocketConversationPayload = (conversation) => ({
  _id: conversation._id,
  type: "support",
  participants: conversation.participants,
  supportStatus: conversation.supportStatus,
  supportCreatedByUserId:
    conversation.supportCreatedByUser?._id ??
    conversation.supportCreatedByUserId?._id ??
    conversation.supportCreatedByUserId,
  supportCreatedByUser: conversation.supportCreatedByUser ?? null,
  assignedAdminId:
    conversation.assignedAdmin?._id ??
    conversation.assignedAdminId?._id ??
    conversation.assignedAdminId ??
    null,
  assignedAdmin: conversation.assignedAdmin ?? null,
  lastMessage: conversation.lastMessage ?? null,
  lastMessageAt: conversation.lastMessageAt ?? conversation.updatedAt,
  unreadCounts: conversation.unreadCounts ?? {},
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

/**
 * Lấy hoặc tạo cuộc trò chuyện hỗ trợ hiện tại cho người dùng
 * POST /support/conversations
 */
export const getOrCreateSupportConversation = async (req, res) => {
  try {
    const userId = req.user._id;

    // Kiểm tra người dùng đã có cuộc trò chuyện hỗ trợ đang mở hay chưa
    let supportConversation = await Conversation.findOne({
      type: "support",
      supportCreatedByUserId: userId,
      supportStatus: { $in: SUPPORT_STATUS_OPEN_SET },
    });

    // Nếu chưa có cuộc trò chuyện đang mở thì tạo mới
    if (!supportConversation) {
      const admin = await User.findOne({
        role: {
          $in: [APP_ROLES.SUPER_ADMIN, APP_ROLES.ADMIN, APP_ROLES.SUPPORT],
        },
        status: "active",
      })
        .sort({ updatedAt: -1, createdAt: 1 })
        .select("_id");

      if (!admin) {
        return res.status(503).json({
          message: "Hiện không có quản trị viên hỗ trợ. Vui lòng thử lại sau.",
        });
      }

      supportConversation = new Conversation({
        type: "support",
        supportStatus: "open",
        supportCreatedByUserId: userId,
        assignedAdminId: admin._id,
        participants: [
          { userId: userId, joinedAt: new Date() },
          { userId: admin._id, joinedAt: new Date() },
        ],
        unreadCounts: {
          [userId.toString()]: 0,
          [admin._id.toString()]: 1,
        },
      });

      await supportConversation.save();
      await populateSupportConversation(supportConversation);
      const formattedConversation = formatSupportConversation(supportConversation);

      await emitSupportConversationRealtime({
        type: "new-conversation",
        conversation: formattedConversation,
        actor: req.user,
      });

      return res.json({
        message: "Lấy cuộc trò chuyện hỗ trợ thành công",
        data: { conversation: formattedConversation },
      });
    }

    await populateSupportConversation(supportConversation);
    const formattedConversation = formatSupportConversation(supportConversation);

    res.json({
      message: "Lấy cuộc trò chuyện hỗ trợ thành công",
      data: { conversation: formattedConversation },
    });
  } catch (error) {
    console.error("Lỗi khi lấy hoặc tạo cuộc trò chuyện hỗ trợ:", error);
    res.status(500).json({ message: "Không thể lấy cuộc trò chuyện hỗ trợ" });
  }
};

export const getCurrentSupportConversation = getOrCreateSupportConversation;

/**
 * Lấy danh sách cuộc trò chuyện hỗ trợ của người dùng
 * GET /support/conversations/me
 */
export const getUserSupportConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, sort = "updatedAt-desc" } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    let sortObj = { updatedAt: -1 };
    if (sort === "createdAt-desc") {
      sortObj = { createdAt: -1 };
    } else if (sort === "createdAt-asc") {
      sortObj = { createdAt: 1 };
    }

    const conversations = await Conversation.find({
      type: "support",
      supportCreatedByUserId: userId,
      userDeletedAt: null,
    })
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .populate("participants.userId", "displayName userName avatarUrl role email")
      .populate("supportCreatedByUserId", "displayName userName avatarUrl email role")
      .populate("assignedAdminId", "displayName userName avatarUrl email role");

    const total = await Conversation.countDocuments({
      type: "support",
      supportCreatedByUserId: userId,
      userDeletedAt: null,
    });

    res.json({
      message: "Lấy danh sách cuộc trò chuyện hỗ trợ thành công",
      data: {
        conversations: conversations.map(formatSupportConversation),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách cuộc trò chuyện hỗ trợ:", error);
    res.status(500).json({ message: "Không thể lấy danh sách cuộc trò chuyện hỗ trợ" });
  }
};

/**
 * Gửi tin nhắn trong cuộc trò chuyện hỗ trợ
 * POST /support/messages
 */
export const sendSupportMessage = async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const userId = req.user._id;

    if (!conversationId) {
      return res.status(400).json({ message: "Thiếu mã cuộc trò chuyện" });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: "Vui lòng nhập nội dung tin nhắn" });
    }

    // Kiểm tra người dùng có quyền truy cập cuộc trò chuyện hỗ trợ này hay không
    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "support",
      supportCreatedByUserId: userId,
    });

    if (!conversation) {
      return res.status(403).json({
        message: "Bạn không có quyền truy cập cuộc trò chuyện hỗ trợ này",
      });
    }

    // Nếu cuộc trò chuyện đã đóng/xử lý xong mà người dùng gửi tin nhắn mới thì mở lại
    if (conversation.supportStatus === "resolved" || conversation.supportStatus === "closed") {
      conversation.supportStatus = "open";
      conversation.lastMessageAt = new Date();
    }

    // Tạo tin nhắn
    const message = new Message({
      conversationId,
      senderId: userId,
      content: content.trim(),
      type: "user",
    });

    await message.save();

    // Cập nhật cuộc trò chuyện
    conversation.lastMessageAt = new Date();
    conversation.lastMessage = {
      _id: message._id.toString(),
      content: message.content,
      senderId: message.senderId,
      senderDeleted: false,
      senderDisplayName: req.user.displayName,
      senderAvatar: req.user.avatarUrl,
      createdAt: message.createdAt,
    };

    // Đặt lại số tin chưa đọc cho người gửi và tăng cho người còn lại
    const unreadCounts = new Map(conversation.unreadCounts || {});
    unreadCounts.set(userId.toString(), 0);

    conversation.participants.forEach((participant) => {
      if (participant.userId.toString() !== userId.toString()) {
        const key = participant.userId.toString();
        unreadCounts.set(key, (unreadCounts.get(key) || 0) + 1);
      }
    });

    conversation.unreadCounts = unreadCounts;
    await conversation.save();
    await populateSupportConversation(conversation);
    const formattedConversation = formatSupportConversation(conversation);
    const socketConversationPayload = buildSocketConversationPayload(formattedConversation);

    const socketMessagePayload = {
      _id: message._id,
      conversationId,
      senderId: userId,
      senderDisplayName: req.user.displayName,
      senderAvatar: req.user.avatarUrl,
      content: message.content,
      createdAt: message.createdAt,
      type: "user",
    };

    await emitSupportConversationRealtime({
      type: "user-message",
      conversation: {
        ...socketConversationPayload,
        unreadCounts: Object.fromEntries(unreadCounts),
      },
      message: socketMessagePayload,
      actor: req.user,
    });

    emitToUser(userId, "new-message", {
      message: socketMessagePayload,
      conversation: socketConversationPayload,
      unreadCounts: Object.fromEntries(unreadCounts),
    });

    res.status(201).json({
      message: "Gửi tin nhắn hỗ trợ thành công",
      data: {
        message,
        conversation: formattedConversation,
      },
    });
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn hỗ trợ:", error);
    res.status(500).json({ message: "Không thể gửi tin nhắn" });
  }
};

/**
 * Lấy chi tiết cuộc trò chuyện hỗ trợ kèm danh sách tin nhắn
 * GET /support/conversations/:id
 */
export const getSupportConversationDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: id,
      type: "support",
      supportCreatedByUserId: userId,
    });

    if (!conversation) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện hỗ trợ" });
    }

    await populateSupportConversation(conversation);

    // Lấy danh sách tin nhắn
    const messages = await Message.find({ conversationId: id })
      .sort({ createdAt: 1 })
      .lean();

    // Đánh dấu đã đọc
    const unreadCounts = new Map(conversation.unreadCounts || {});
    unreadCounts.set(userId.toString(), 0);
    conversation.unreadCounts = unreadCounts;
    await conversation.save();

    res.json({
      message: "Lấy chi tiết cuộc trò chuyện hỗ trợ thành công",
      data: {
        conversation: formatSupportConversation(conversation),
        messages,
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy chi tiết cuộc trò chuyện hỗ trợ:", error);
    res.status(500).json({ message: "Không thể lấy chi tiết cuộc trò chuyện hỗ trợ" });
  }
};

/**
 * Xóa cuộc trò chuyện hỗ trợ phía người dùng
 * DELETE /support/conversations/:id
 */
export const deleteSupportConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: id,
      type: "support",
      supportCreatedByUserId: userId,
    });

    if (!conversation) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện hỗ trợ" });
    }

    // Đánh dấu người dùng đã xóa, nhưng vẫn giữ lịch sử cho admin
    conversation.userDeletedAt = new Date();
    await conversation.save();

    res.json({
      message: "Xóa cuộc trò chuyện hỗ trợ thành công",
      data: { conversationId: id },
    });
  } catch (error) {
    console.error("Lỗi khi xóa cuộc trò chuyện hỗ trợ:", error);
    res.status(500).json({ message: "Không thể xóa cuộc trò chuyện hỗ trợ" });
  }
};
