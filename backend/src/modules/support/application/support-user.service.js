import Conversation from "../../../models/Conversation.js";
import Message from "../../../models/Message.js";
import User from "../../../models/User.js";
import { APP_ROLES } from "../../../constants/rbac.js";
import { emitToUser } from "../../../shared/infrastructure/realtime/socket-gateway.js";
import { emitSupportConversationRealtime } from "../../../services/supportRealtimeService.js";
import { SUPPORT_STATUS_OPEN_SET } from "../domain/support-status.js";
import {
  buildSupportConversationSocketPayload,
  formatSupportConversation,
  populateSupportConversation,
} from "../infrastructure/support-presenter.js";

export const getOrCreateSupportConversationForUser = async ({ user }) => {
  const userId = user._id;

  let supportConversation = await Conversation.findOne({
    type: "support",
    supportCreatedByUserId: userId,
    supportStatus: { $in: SUPPORT_STATUS_OPEN_SET },
  });

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
      const error = new Error(
        "Hiện không có quản trị viên hỗ trợ. Vui lòng thử lại sau.",
      );
      error.status = 503;
      throw error;
    }

    supportConversation = new Conversation({
      type: "support",
      supportStatus: "open",
      supportCreatedByUserId: userId,
      assignedAdminId: admin._id,
      participants: [
        { userId, joinedAt: new Date() },
        { userId: admin._id, joinedAt: new Date() },
      ],
      unreadCounts: {
        [userId.toString()]: 0,
        [admin._id.toString()]: 1,
      },
    });

    await supportConversation.save();
    await populateSupportConversation(supportConversation);
    const formattedConversation =
      formatSupportConversation(supportConversation);

    await emitSupportConversationRealtime({
      type: "new-conversation",
      conversation: formattedConversation,
      actor: user,
    });

    return formattedConversation;
  }

  await populateSupportConversation(supportConversation);
  return formatSupportConversation(supportConversation);
};

export const getUserSupportConversationsQuery = async ({
  userId,
  page = 1,
  limit = 20,
  sort,
}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  let sortObj = { updatedAt: -1 };
  if (sort === "createdAt-desc") sortObj = { createdAt: -1 };
  else if (sort === "createdAt-asc") sortObj = { createdAt: 1 };

  const conversations = await Conversation.find({
    type: "support",
    supportCreatedByUserId: userId,
    userDeletedAt: null,
  })
    .sort(sortObj)
    .skip(skip)
    .limit(limitNum)
    .populate(
      "participants.userId",
      "displayName userName avatarUrl role email",
    )
    .populate(
      "supportCreatedByUserId",
      "displayName userName avatarUrl email role",
    )
    .populate("assignedAdminId", "displayName userName avatarUrl email role");

  const total = await Conversation.countDocuments({
    type: "support",
    supportCreatedByUserId: userId,
    userDeletedAt: null,
  });

  return {
    conversations: conversations.map(formatSupportConversation),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  };
};

export const getSupportConversationDetailForUser = async ({
  userId,
  conversationId,
}) => {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    type: "support",
    supportCreatedByUserId: userId,
  });

  if (!conversation) {
    const error = new Error("Không tìm thấy cuộc trò chuyện hỗ trợ");
    error.status = 404;
    throw error;
  }

  await populateSupportConversation(conversation);
  const messages = await Message.find({ conversationId })
    .sort({ createdAt: 1 })
    .lean();

  const unreadCounts = new Map(conversation.unreadCounts || {});
  unreadCounts.set(userId.toString(), 0);
  conversation.unreadCounts = unreadCounts;
  await conversation.save();

  return {
    conversation: formatSupportConversation(conversation),
    messages,
  };
};

export const sendSupportMessageCommand = async ({
  user,
  conversationId,
  content,
}) => {
  const userId = user._id;

  if (!conversationId) {
    const error = new Error("Thiếu mã cuộc trò chuyện");
    error.status = 400;
    throw error;
  }

  if (!content || content.trim().length === 0) {
    const error = new Error("Vui lòng nhập nội dung tin nhắn");
    error.status = 400;
    throw error;
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    type: "support",
    supportCreatedByUserId: userId,
  });

  if (!conversation) {
    const error = new Error(
      "Bạn không có quyền truy cập cuộc trò chuyện hỗ trợ này",
    );
    error.status = 403;
    throw error;
  }

  if (
    conversation.supportStatus === "resolved" ||
    conversation.supportStatus === "closed"
  ) {
    conversation.supportStatus = "open";
    conversation.lastMessageAt = new Date();
  }

  const message = new Message({
    conversationId,
    senderId: userId,
    content: content.trim(),
    type: "user",
  });
  await message.save();

  conversation.lastMessageAt = new Date();
  conversation.lastMessage = {
    _id: message._id.toString(),
    content: message.content,
    senderId: message.senderId,
    senderDeleted: false,
    senderDisplayName: user.displayName,
    senderAvatar: user.avatarUrl,
    createdAt: message.createdAt,
  };

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
  const socketConversationPayload = buildSupportConversationSocketPayload(
    formattedConversation,
  );
  const socketMessagePayload = {
    _id: message._id,
    conversationId,
    senderId: userId,
    senderDisplayName: user.displayName,
    senderAvatar: user.avatarUrl,
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
    actor: user,
  });

  emitToUser(userId, "new-message", {
    message: socketMessagePayload,
    conversation: socketConversationPayload,
    unreadCounts: Object.fromEntries(unreadCounts),
  });

  return {
    message,
    conversation: formattedConversation,
  };
};

export const deleteSupportConversationForUser = async ({
  userId,
  conversationId,
}) => {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    type: "support",
    supportCreatedByUserId: userId,
  });

  if (!conversation) {
    const error = new Error("Không tìm thấy cuộc trò chuyện hỗ trợ");
    error.status = 404;
    throw error;
  }

  conversation.userDeletedAt = new Date();
  await conversation.save();

  return { conversationId };
};
