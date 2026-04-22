import Conversation from "../../../../models/Conversation.js";
import Message from "../../../../models/Message.js";
import User from "../../../../models/User.js";
import { emitToUser } from "../../../../shared/infrastructure/realtime/socket-gateway.js";
import { ADMIN_SOCKET_EVENTS } from "../../../../constants/socketEvents.js";
import { emitToAdmins } from "../../../../shared/infrastructure/realtime/admin-room.js";
import {
  buildAdminActor,
  emitAdminNotification,
} from "../../../../services/adminNotificationService.js";
import { emitDashboardStatsUpdated } from "../../../../services/dashboardRealtimeService.js";
import { emitSupportConversationRealtime } from "../../../../services/supportRealtimeService.js";
import { escapeRegex } from "../../../../utils/regex.js";
import { APP_PERMISSIONS } from "../../../../constants/rbac.js";
import { hasPermission } from "../../../../services/rbacService.js";
const SUPPORT_STATUS_SET = ["open", "in_progress", "resolved", "closed"];

const populateSupportConversation = async (conversation) => {
  await conversation.populate([
    {
      path: "participants.userId",
      select: "displayName userName avatarUrl email role",
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
    displayName: participant.userId?.displayName ?? null,
    userName: participant.userId?.userName ?? null,
    avatarUrl: participant.userId?.avatarUrl ?? null,
    email: participant.userId?.email ?? null,
    role: participant.userId?.role ?? null,
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

const buildSupportConversationSocketPayload = (conversation) => ({
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
 * Lấy danh sách cuộc trò chuyện hỗ trợ cho quản trị viên
 * GET /admin/support/conversations
 */
export const getSupportConversations = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      q,
      sort = "updatedAt-desc",
      assignedAdminId,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = { type: "support" };

    // Lọc theo trạng thái
    if (status && SUPPORT_STATUS_SET.includes(status)) {
      query.supportStatus = status;
    }

    // Lọc theo quản trị viên được phân công
    if (assignedAdminId && assignedAdminId !== "unassigned") {
      query.assignedAdminId = assignedAdminId;
    } else if (assignedAdminId === "unassigned") {
      query.assignedAdminId = null;
    }

    // Tìm theo tên đăng nhập hoặc tên hiển thị của người dùng
    if (q && q.trim().length > 0) {
      const users = await User.find({
        $or: [
          { userName: new RegExp(escapeRegex(q.trim()), "i") },
          { displayName: new RegExp(escapeRegex(q.trim()), "i") },
        ],
      }).select("_id");

      const userIds = users.map((u) => u._id);
      query.supportCreatedByUserId = { $in: userIds };
    }

    // Sắp xếp
    let sortObj = { updatedAt: -1 };
    if (sort === "createdAt-desc") {
      sortObj = { createdAt: -1 };
    } else if (sort === "createdAt-asc") {
      sortObj = { createdAt: 1 };
    } else if (sort === "status") {
      sortObj = { supportStatus: 1, updatedAt: -1 };
    }

    const conversations = await Conversation.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .populate("supportCreatedByUserId", "displayName userName avatarUrl email")
      .populate("assignedAdminId", "displayName userName avatarUrl")
      .populate("participants.userId", "displayName userName avatarUrl email role");

    const total = await Conversation.countDocuments(query);

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
 * Lấy chi tiết cuộc trò chuyện hỗ trợ cho quản trị viên
 * GET /admin/support/conversations/:id
 */
export const getSupportConversationDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await Conversation.findOne({
      _id: id,
      type: "support",
    });

    if (!conversation) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện hỗ trợ" });
    }

    await populateSupportConversation(conversation);

    // Lấy danh sách tin nhắn
    const messages = await Message.find({ conversationId: id })
      .sort({ createdAt: 1 })
      .lean();

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
 * Gửi phản hồi hỗ trợ từ quản trị viên
 * POST /admin/support/messages
 */
export const sendSupportReply = async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const adminId = req.user._id;

    if (!conversationId) {
      return res.status(400).json({ message: "Thiếu mã cuộc trò chuyện" });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: "Vui lòng nhập nội dung tin nhắn" });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "support",
    });

    if (!conversation) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện hỗ trợ" });
    }

    // Tự động gán quản trị viên nếu cuộc trò chuyện chưa có người phụ trách
    if (!conversation.assignedAdminId) {
      conversation.assignedAdminId = adminId;
      conversation.supportStatus = "in_progress";
    }

    // Tạo tin nhắn
    const message = new Message({
      conversationId,
      senderId: adminId,
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
    unreadCounts.set(adminId.toString(), 0);

    conversation.participants.forEach((participant) => {
      if (participant.userId.toString() !== adminId.toString()) {
        const key = participant.userId.toString();
        unreadCounts.set(key, (unreadCounts.get(key) || 0) + 1);
      }
    });

    conversation.unreadCounts = unreadCounts;
    await conversation.save();
    await populateSupportConversation(conversation);
    const formattedConversation = formatSupportConversation(conversation);
    const socketConversationPayload = buildSupportConversationSocketPayload(
      formattedConversation,
    );

    const socketMessagePayload = {
      _id: message._id,
      conversationId,
      senderId: adminId,
      senderDisplayName: req.user.displayName,
      senderAvatar: req.user.avatarUrl,
      content: message.content,
      createdAt: message.createdAt,
      type: "user",
    };

    await emitSupportConversationRealtime({
      type: "reply",
      conversation: {
        ...socketConversationPayload,
        unreadCounts: Object.fromEntries(unreadCounts),
      },
      message: socketMessagePayload,
      actor: req.user,
    });

    const requesterUserId =
      formattedConversation.supportCreatedByUser?._id ??
      formattedConversation.supportCreatedByUserId;

    if (requesterUserId) {
      emitToUser(requesterUserId, "new-message", {
        message: socketMessagePayload,
        conversation: socketConversationPayload,
        unreadCounts: Object.fromEntries(unreadCounts),
      });
    }

    await emitDashboardStatsUpdated({
      reason: "support:reply",
      conversationId,
    });

    res.status(201).json({
      message: "Gửi phản hồi hỗ trợ thành công",
      data: {
        message,
        conversation: formattedConversation,
      },
    });
  } catch (error) {
    console.error("Lỗi khi gửi phản hồi hỗ trợ:", error);
    res.status(500).json({ message: "Không thể gửi phản hồi hỗ trợ" });
  }
};

/**
 * Cập nhật trạng thái cuộc trò chuyện hỗ trợ
 * PATCH /admin/support/conversations/:id/status
 */
export const updateSupportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user._id;

    if (!status || !SUPPORT_STATUS_SET.includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ" });
    }

    const conversation = await Conversation.findOne({
      _id: id,
      type: "support",
    });

    if (!conversation) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện hỗ trợ" });
    }

    // Tự động gán quản trị viên nếu chưa có người phụ trách và trạng thái được thay đổi
    if (!conversation.assignedAdminId && status !== "open") {
      conversation.assignedAdminId = adminId;
    }

    conversation.supportStatus = status;
    conversation.lastMessageAt = new Date();
    await conversation.save();
    await populateSupportConversation(conversation);
    const formattedConversation = formatSupportConversation(conversation);

    emitToAdmins(ADMIN_SOCKET_EVENTS.SUPPORT_NEW_MESSAGE, {
      conversationId: id,
      status,
      assignedAdminId:
        formattedConversation.assignedAdmin?._id ??
        formattedConversation.assignedAdminId,
      conversation: formattedConversation,
      createdAt: new Date().toISOString(),
    });
    emitAdminNotification({
      type: "support",
      title: "Trang thai ho tro da thay doi",
      message: `Hoi thoai ${id.toString().slice(-6)} da chuyen sang ${status}`,
      link: `/admin/support/${id}`,
      entityId: id.toString(),
      actor: buildAdminActor(req.user),
      metadata: { status },
    });
    await emitDashboardStatsUpdated({ reason: "support:status", conversationId: id });

    res.json({
      message: "Cập nhật trạng thái hỗ trợ thành công",
      data: { conversation: formattedConversation },
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái hỗ trợ:", error);
    res.status(500).json({ message: "Không thể cập nhật trạng thái hỗ trợ" });
  }
};

/**
 * Gán quản trị viên cho cuộc trò chuyện hỗ trợ
 * PATCH /admin/support/conversations/:id/assign
 */
export const assignSupportAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({ message: "Thiếu mã quản trị viên" });
    }

    const conversation = await Conversation.findOne({
      _id: id,
      type: "support",
    });

    if (!conversation) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện hỗ trợ" });
    }

    // Kiểm tra quản trị viên có tồn tại hay không
    const admin = await User.findById(adminId);
    if (!admin || !hasPermission(admin.toObject(), APP_PERMISSIONS.SUPPORT_VIEW)) {
      return res.status(400).json({ message: "Mã quản trị viên không hợp lệ" });
    }

    conversation.assignedAdminId = adminId;
    if (conversation.supportStatus === "open") {
      conversation.supportStatus = "in_progress";
    }
    await conversation.save();
    await populateSupportConversation(conversation);
    const formattedConversation = formatSupportConversation(conversation);

    emitToAdmins(ADMIN_SOCKET_EVENTS.SUPPORT_NEW_MESSAGE, {
      conversationId: id,
      assignedAdminId: adminId,
      adminName: admin.displayName,
      conversation: formattedConversation,
      createdAt: new Date().toISOString(),
    });
    emitAdminNotification({
      type: "support",
      title: "Hoi thoai da duoc assign",
      message: `${admin.displayName} vua nhan xu ly mot yeu cau ho tro`,
      link: `/admin/support/${id}`,
      entityId: id.toString(),
      actor: buildAdminActor(admin),
    });
    await emitDashboardStatsUpdated({ reason: "support:assigned", conversationId: id });

    res.json({
      message: "Gán quản trị viên thành công",
      data: { conversation: formattedConversation },
    });
  } catch (error) {
    console.error("Lỗi khi gán quản trị viên hỗ trợ:", error);
    res.status(500).json({ message: "Không thể gán quản trị viên" });
  }
};
