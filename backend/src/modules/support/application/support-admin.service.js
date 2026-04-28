import Conversation from "../../../models/Conversation.js";
import Message from "../../../models/Message.js";
import User from "../../../models/User.js";
import { emitToUser } from "../../../shared/infrastructure/realtime/socket-gateway.js";
import { ADMIN_SOCKET_EVENTS } from "../../../constants/socketEvents.js";
import { emitToAdmins } from "../../../shared/infrastructure/realtime/admin-room.js";
import {
  buildAdminActor,
  emitAdminNotification,
} from "../../../services/adminNotificationService.js";
import { emitDashboardStatsUpdated } from "../../../services/dashboardRealtimeService.js";
import { emitSupportConversationRealtime } from "../../../services/supportRealtimeService.js";
import { escapeRegex } from "../../../utils/regex.js";
import { APP_PERMISSIONS } from "../../../constants/rbac.js";
import { hasPermission } from "../../../services/rbacService.js";
import { SUPPORT_STATUS_SET } from "../domain/support-status.js";
import {
  buildSupportConversationSocketPayload,
  formatSupportConversation,
  populateSupportConversation,
} from "../infrastructure/support-presenter.js";

export const getSupportConversationsQuery = async ({
  page = 1,
  limit = 20,
  status,
  q,
  sort = "updatedAt-desc",
  assignedAdminId,
}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;
  const query = { type: "support" };

  if (status && SUPPORT_STATUS_SET.includes(status)) {
    query.supportStatus = status;
  }

  if (assignedAdminId && assignedAdminId !== "unassigned") {
    query.assignedAdminId = assignedAdminId;
  } else if (assignedAdminId === "unassigned") {
    query.assignedAdminId = null;
  }

  if (q && q.trim().length > 0) {
    const users = await User.find({
      $or: [
        { userName: new RegExp(escapeRegex(q.trim()), "i") },
        { displayName: new RegExp(escapeRegex(q.trim()), "i") },
      ],
    }).select("_id");

    query.supportCreatedByUserId = { $in: users.map((user) => user._id) };
  }

  let sortObj = { updatedAt: -1 };
  if (sort === "createdAt-desc") sortObj = { createdAt: -1 };
  else if (sort === "createdAt-asc") sortObj = { createdAt: 1 };
  else if (sort === "status") sortObj = { supportStatus: 1, updatedAt: -1 };

  const conversations = await Conversation.find(query)
    .sort(sortObj)
    .skip(skip)
    .limit(limitNum)
    .populate("supportCreatedByUserId", "displayName userName avatarUrl email")
    .populate("assignedAdminId", "displayName userName avatarUrl")
    .populate(
      "participants.userId",
      "displayName userName avatarUrl email role",
    );

  const total = await Conversation.countDocuments(query);

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

export const getSupportConversationDetailQuery = async ({ conversationId }) => {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    type: "support",
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

  return {
    conversation: formatSupportConversation(conversation),
    messages,
  };
};

export const sendSupportReplyCommand = async ({
  admin,
  conversationId,
  content,
}) => {
  const adminId = admin._id;

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
  });

  if (!conversation) {
    const error = new Error("Không tìm thấy cuộc trò chuyện hỗ trợ");
    error.status = 404;
    throw error;
  }

  if (!conversation.assignedAdminId) {
    conversation.assignedAdminId = adminId;
    conversation.supportStatus = "in_progress";
  }

  const message = new Message({
    conversationId,
    senderId: adminId,
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
    senderDisplayName: admin.displayName,
    senderAvatar: admin.avatarUrl,
    createdAt: message.createdAt,
  };

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
    senderDisplayName: admin.displayName,
    senderAvatar: admin.avatarUrl,
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
    actor: admin,
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

  return {
    message,
    conversation: formattedConversation,
  };
};

export const updateSupportStatusCommand = async ({
  admin,
  conversationId,
  status,
}) => {
  if (!status || !SUPPORT_STATUS_SET.includes(status)) {
    const error = new Error("Trạng thái không hợp lệ");
    error.status = 400;
    throw error;
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    type: "support",
  });

  if (!conversation) {
    const error = new Error("Không tìm thấy cuộc trò chuyện hỗ trợ");
    error.status = 404;
    throw error;
  }

  if (!conversation.assignedAdminId && status !== "open") {
    conversation.assignedAdminId = admin._id;
  }

  conversation.supportStatus = status;
  conversation.lastMessageAt = new Date();
  await conversation.save();
  await populateSupportConversation(conversation);
  const formattedConversation = formatSupportConversation(conversation);

  emitToAdmins(ADMIN_SOCKET_EVENTS.SUPPORT_NEW_MESSAGE, {
    conversationId,
    status,
    assignedAdminId:
      formattedConversation.assignedAdmin?._id ??
      formattedConversation.assignedAdminId,
    conversation: formattedConversation,
    createdAt: new Date().toISOString(),
  });
  emitAdminNotification({
    type: "support",
    title: "Trạng thái hỗ trợ đã thay đổi",
    message: `Hội thọai ${conversationId.toString().slice(-6)} đã chuyển sang ${status}`,
    link: `/admin/support/${conversationId}`,
    entityId: conversationId.toString(),
    actor: buildAdminActor(admin),
    metadata: { status },
  });
  await emitDashboardStatsUpdated({
    reason: "support:status",
    conversationId,
  });

  return formattedConversation;
};

export const assignSupportAdminCommand = async ({
  conversationId,
  adminId,
}) => {
  if (!adminId) {
    const error = new Error("Thiếu mã quản trị viên");
    error.status = 400;
    throw error;
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    type: "support",
  });

  if (!conversation) {
    const error = new Error("Không tìm thấy cuộc trò chuyện hỗ trợ");
    error.status = 404;
    throw error;
  }

  const admin = await User.findById(adminId);
  if (
    !admin ||
    !hasPermission(admin.toObject(), APP_PERMISSIONS.SUPPORT_VIEW)
  ) {
    const error = new Error("Mã quản trị viên không hợp lệ");
    error.status = 400;
    throw error;
  }

  conversation.assignedAdminId = adminId;
  if (conversation.supportStatus === "open") {
    conversation.supportStatus = "in_progress";
  }
  await conversation.save();
  await populateSupportConversation(conversation);
  const formattedConversation = formatSupportConversation(conversation);

  emitToAdmins(ADMIN_SOCKET_EVENTS.SUPPORT_NEW_MESSAGE, {
    conversationId,
    assignedAdminId: adminId,
    adminName: admin.displayName,
    conversation: formattedConversation,
    createdAt: new Date().toISOString(),
  });
  emitAdminNotification({
    type: "support",
    title: "Hội thọai đã được assign",
    message: `${admin.displayName} vừa nhận xử lý một yêu cầu hỗ trợ`,
    link: `/admin/support/${conversationId}`,
    entityId: conversationId.toString(),
    actor: buildAdminActor(admin),
  });
  await emitDashboardStatsUpdated({
    reason: "support:assigned",
    conversationId,
  });

  return formattedConversation;
};
