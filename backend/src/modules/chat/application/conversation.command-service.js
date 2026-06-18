import Conversation from "../../../models/Conversation.js";
import Message from "../../../models/Message.js";
import User from "../../../models/User.js";
import {
  deleteImageFromCloudinary,
  uploadImageFromBuffer,
} from "../../../middlewares/uploadMiddleWare.js";
import { getIo } from "../../../shared/infrastructure/realtime/socket-registry.js";
import {
  emitToRoom,
  emitToUser,
} from "../../../shared/infrastructure/realtime/socket-gateway.js";
import {
  buildDirectBlockInfo,
  ensureDirectMessagingAllowed,
  findDirectConversationBetweenUsers,
} from "../domain/direct-blocking.policy.js";
import {
  emitNewMessage,
  updateConversationAfterCreateMessage,
} from "../infrastructure/realtime/message-realtime.js";
import {
  getConversationParticipantIds,
  invalidateConversationListForConversation,
  invalidateConversationListForUser,
  invalidateConversationListForUsers,
} from "../infrastructure/cache/conversation-list-cache.service.js";
import { invalidateAdminDashboardCache } from "../../admin-panel/infrastructure/cache/admin-dashboard-cache.service.js";

// Hàm lấy thông tin conversation đã được populate và format lại cho client
const populateConversationForClient = async (conversation) => {
  await conversation.populate([
    {
      path: "participants.userId",
      select: "userName displayName avatarUrl bio blockedUsers",
    },
    { path: "seenBy", select: "displayName avatarUrl" },
    { path: "lastMessage.senderId", select: "displayName avatarUrl" },
  ]);

  return conversation;
};

// hàm format lại conversation 
export const formatConversationForClient = (conversation) => {
  const participants = (conversation.participants || []).map((p) => ({
    _id: p.userId?._id,
    userName: p.userId?.userName,
    displayName: p.userId?.displayName,
    avatarUrl: p.userId?.avatarUrl ?? null,
    bio: p.userId?.bio ?? null,
    joinedAt: p.joinedAt,
  }));

  return {
    ...conversation.toObject(),
    unreadCounts: conversation.unreadCounts || {},
    participants,
  };
};

// hàm đính kèm thông tin block nếu là conversation direct
export const attachBlockInfoToConversation = (conversation, viewerUser) => {
  if (!conversation || conversation.type !== "direct" || !viewerUser?._id) {
    return conversation;
  }

  const sanitizedParticipants = (conversation.participants || []).map((participant) => {
    const { blockedUsers, ...rest } = participant;
    return rest;
  });

  const otherParticipant = (conversation.participants || []).find(
    (participant) => participant._id?.toString() !== viewerUser._id.toString(),
  );

  if (!otherParticipant?._id) {
    return {
      ...conversation,
      participants: sanitizedParticipants,
    };
  }

  const otherBlockedUsers =
    otherParticipant.blockedUsers ??
    otherParticipant.userId?.blockedUsers ??
    [];

  return {
    ...conversation,
    participants: sanitizedParticipants,
    blockInfo: buildDirectBlockInfo({
      viewerId: viewerUser._id,
      otherUserId: otherParticipant._id,
      viewerUser,
      otherUser: { blockedUsers: otherBlockedUsers },
    }),
  };
};

// hàm tạo message hệ thống và cập nhật conversation sau khi tạo message
const createSystemMessage = async (conversation, actorId, content) => {
  const message = await Message.create({
    conversationId: conversation._id,
    senderId: actorId,
    type: "system",
    content,
  });

  await updateConversationAfterCreateMessage(conversation, message, actorId);
  await conversation.save();
  await invalidateConversationListForConversation(
    conversation,
    "system-message",
  );

  return message;
};

// hàm tạo lỗi chung cho module chat
export const createConversationCommand = async ({ user, body }) => {
  const { type, name, memberIds } = body;
  const userId = user._id;

  if (
    !type ||
    (type === "group" && !name) ||
    !memberIds ||
    !Array.isArray(memberIds) ||
    memberIds.length === 0
  ) {
    return {
      error: {
        status: 400,
        message: "Tên nhóm và danh sách thành viên là bắt buộc",
      },
    };
  }

  let conversation;

  if (type === "direct") {
    const participantId = memberIds[0];
    const participantUser = await User.findById(participantId).select("blockedUsers");

    if (!participantUser) {
      return { error: { status: 404, message: "Người dùng không tồn tại" } };
    }

    const directPermission = ensureDirectMessagingAllowed({
      senderUser: user,
      recipientUser: participantUser,
      senderId: userId,
      recipientId: participantId,
    });

    if (!directPermission.allowed) {
      return {
        error: {
          status: directPermission.status,
          message: directPermission.message,
          code: directPermission.code,
        },
      };
    }

    conversation = await Conversation.findOne({
      type: "direct",
      "participants.userId": { $all: [userId, participantId] },
    });

    if (!conversation) {
      conversation = new Conversation({
        type: "direct",
        participants: [{ userId }, { userId: participantId }],
        lastMessageAt: new Date(),
      });

      await conversation.save();
    }
  }

  if (type === "group") {
    const meStr = userId.toString();
    const uniqueMemberIds = [...new Set(memberIds.map((id) => id.toString()))].filter(
      (id) => id !== meStr,
    );

    conversation = new Conversation({
      type: "group",
      participants: [
        { userId },
        ...uniqueMemberIds.map((id) => ({ userId: id })),
      ],
      group: {
        name,
        avatarUrl: null,
        avatarId: null,
        createdBy: userId,
      },
      lastMessageAt: new Date(),
    });
    await conversation.save();
  }

  if (!conversation) {
    return { error: { status: 400, message: "Conversation type không hợp lệ" } };
  }

  await populateConversationForClient(conversation);
  const formatted = attachBlockInfoToConversation(
    formatConversationForClient(conversation),
    user,
  );
  await invalidateConversationListForConversation(
    conversation,
    `create-${type}-conversation`,
  );
  await invalidateAdminDashboardCache(`create-${type}-conversation`);

  if (type === "group") {
    formatted.participants.forEach((participant) => {
      const uid = participant._id?.toString();
      if (!uid) return;
      emitToUser(uid, "new-group", formatted);
    });
  }

  return {
    status: 201,
    payload: { conversation: formatted },
  };
};

// Hàm 
export const markConversationSeenCommand = async ({ conversationId, userId }) => {
  const normalizedUserId = userId.toString();
  const conversation = await Conversation.findById(conversationId).lean();

  if (!conversation) {
    return { error: { status: 404, message: "Conversation không tồn tại " } };
  }

  const last = conversation.lastMessage;
  if (!last) {
    return { status: 200, payload: { message: "Không có tin nhắn để mark as seen" } };
  }

  if (!last.senderId || last.senderId.toString() === normalizedUserId) {
    return { status: 200, payload: { message: "Sender không cần mark as seen" } };
  }

  const updated = await Conversation.findByIdAndUpdate(
    conversationId,
    {
      $addToSet: { seenBy: normalizedUserId },
      $set: { [`unreadCounts.${normalizedUserId}`]: 0 },
    },
    { new: true },
  );

  emitToRoom(conversationId, "read-message", {
    conversation: {
      _id: updated._id,
      unreadCounts: updated.unreadCounts,
      seenBy: updated.seenBy,
      lastMessage: updated.lastMessage,
      lastMessageAt: updated.lastMessageAt,
    },
  });
  await invalidateConversationListForUser(normalizedUserId, "mark-seen");

  return {
    status: 200,
    payload: {
      message: "marked as seen",
      seenBy: updated?.seenBy || [],
      myUnreadCount: updated?.unreadCounts[normalizedUserId] || 0,
    },
  };
};

export const clearDirectConversationForUserCommand = async ({
  conversationId,
  userId,
  userObjectId,
}) => {
  const normalizedUserId = userId.toString();
  const clearedAt = new Date();

  await Conversation.findByIdAndUpdate(conversationId, {
    $pull: {
      clearedFor: { userId: userObjectId },
      seenBy: userObjectId,
    },
    $set: { [`unreadCounts.${normalizedUserId}`]: 0 },
  });

  await Conversation.findByIdAndUpdate(conversationId, {
    $push: {
      clearedFor: {
        userId: userObjectId,
        clearedAt,
      },
    },
  });

  emitToUser(normalizedUserId, "conversation:direct-cleared", { conversationId });
  await invalidateConversationListForUser(
    normalizedUserId,
    "clear-direct-conversation",
  );

  return {
    status: 200,
    payload: {
      message: "Đã xóa lịch sử chat ở phía bạn",
      deleted: false,
      cleared: true,
    },
  };
};

export const deleteOrLeaveConversationCommand = async ({ user, conversationId }) => {
  const userId = user._id.toString();
  const userObjectId = user._id;
  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    return { error: { status: 404, message: "Conversation không tồn tại" } };
  }

  if (conversation.type !== "group" && conversation.type !== "direct") {
    return { error: { status: 400, message: "Chỉ áp dụng cho nhóm  (group)" } };
  }

  const isMember = conversation.participants?.some((p) => p.userId.toString() === userId);
  if (!isMember) {
    return { error: { status: 403, message: "Bạn không thuộc cuộc trò chuyện này" } };
  }

  if (conversation.type === "direct") {
    return clearDirectConversationForUserCommand({
      conversationId,
      userId,
      userObjectId,
    });
  }

  const ownerId = conversation.group?.createdBy?.toString();
  const isOwner = ownerId && ownerId === userId;

  if (isOwner) {
    const memberIds = conversation.participants.map((p) => p.userId.toString());
    await Message.deleteMany({ conversationId });
    await Conversation.deleteOne({ _id: conversationId });

    memberIds.forEach((memberId) => {
      emitToUser(memberId, "conversation:deleted", { conversationId });
    });
    emitToRoom(conversationId, "conversation:deleted", { conversationId });
    await invalidateConversationListForUsers(
      memberIds,
      "delete-group-conversation",
    );
    await invalidateAdminDashboardCache("delete-group-conversation");

    return {
      status: 200,
      payload: {
        message: "Đã xóa nhóm thành công",
        deleted: true,
      },
    };
  }

  const updated = await Conversation.findByIdAndUpdate(
    conversationId,
    {
      $pull: {
        participants: { userId: userObjectId },
        seenBy: userObjectId,
      },
      $unset: { [`unreadCounts.${userId}`]: "" },
    },
    { new: true },
  );

  if (updated) {
    const systemMessage = await createSystemMessage(
      updated,
      userObjectId,
      `${user.displayName || "Một thành viên"} đã rời nhóm`,
    );
    emitNewMessage(getIo(), updated, systemMessage);
  }
  await invalidateConversationListForUsers(
    [
      userId,
      ...(updated?.participants ?? []).map((participant) =>
        participant.userId.toString(),
      ),
    ],
    "leave-group-conversation",
  );
  await invalidateAdminDashboardCache("leave-group-conversation");

  emitToUser(userId, "conversation:left", {
    conversationId,
    userId,
    groupName: conversation.group?.name ?? "Nhóm",
    removedByOther: false,
  });

  emitToRoom(conversationId, "conversation:member-left", {
    conversationId,
    userId,
    participantsCount: updated?.participants?.length ?? 0,
  });

  return {
    status: 200,
    payload: {
      message: "Bạn đã rời nhóm và cuộc trò chuyện đã được xóa ở phía bạn",
      deleted: false,
      left: true,
    },
  };
};

export const addGroupMembersCommand = async ({ user, conversationId, memberIds }) => {
  const userId = user._id.toString();

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return { error: { status: 400, message: "memberIds phải là array không rỗng" } };
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation || conversation.type !== "group") {
    return {
      error: {
        status: 404,
        message: "Cuộc trò chuyện không tồn tại hoặc không phải nhóm",
      },
    };
  }

  const isOwner = conversation.group?.createdBy?.toString() === userId.toString();
  if (!isOwner) {
    return { error: { status: 403, message: "Chỉ chủ nhóm mới có thể thêm thành viên" } };
  }

  const existing = new Set(conversation.participants.map((p) => p.userId.toString()));
  const newMemberIds = memberIds.filter((id) => !existing.has(id.toString()));

  if (newMemberIds.length === 0) {
    return { error: { status: 400, message: "Tất cả thành viên đã có trong nhóm" } };
  }

  const newParticipants = newMemberIds.map((id) => ({
    userId: id,
    joinedAt: new Date(),
  }));

  const updated = await Conversation.findByIdAndUpdate(
    conversationId,
    { $push: { participants: { $each: newParticipants } } },
    { new: true },
  );

  const addedUsers = await User.find({ _id: { $in: newMemberIds } }).select("displayName");
  for (const addedUser of addedUsers) {
    const systemMessage = await createSystemMessage(
      updated,
      user._id,
      `${addedUser.displayName || "Một thành viên"} vừa tham gia cuộc trò chuyện`,
    );
    emitNewMessage(getIo(), updated, systemMessage);
  }

  const populatedConversation = await Conversation.findById(conversationId).populate([
    { path: "participants.userId", select: "displayName avatarUrl" },
    { path: "group.createdBy", select: "displayName avatarUrl" },
  ]);

  if (!populatedConversation) {
    return { error: { status: 404, message: "Cuộc trò chuyện không tồn tại" } };
  }

  emitToRoom(conversationId, "conversation:members-added", {
    conversationId,
    newMembers: newMemberIds,
    participants: formatConversationForClient(populatedConversation).participants,
  });

  newMemberIds.forEach((memberId) => {
    emitToUser(memberId, "new-group", formatConversationForClient(populatedConversation));
    emitToUser(memberId, "added-to-group", {
      groupId: conversationId,
      groupName: populatedConversation.group.name,
    });
  });
  await invalidateConversationListForUsers(
    [
      ...getConversationParticipantIds(populatedConversation),
      ...newMemberIds,
    ],
    "add-group-members",
  );
  await invalidateAdminDashboardCache("add-group-members");

  return {
    status: 200,
    payload: {
      message: "Thêm thành viên thành công",
      conversation: populatedConversation,
    },
  };
};

export const removeGroupMemberCommand = async ({ user, conversationId, memberId }) => {
  const userId = user._id.toString();

  if (!memberId) {
    return { error: { status: 400, message: "memberId là bắt buộc" } };
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation || conversation.type !== "group") {
    return {
      error: {
        status: 404,
        message: "Cuộc trò chuyện không tồn tại hoặc không phải nhóm",
      },
    };
  }

  const isOwner = conversation.group?.createdBy?.toString() === userId.toString();
  const isSelf = userId.toString() === memberId.toString();

  if (!isOwner && !isSelf) {
    return {
      error: {
        status: 403,
        message:
          "Chỉ chủ nhóm mới có thể xóa thành viên khác, bạn chỉ có thể rời nhóm",
      },
    };
  }

  const isMember = conversation.participants?.some(
    (p) => p.userId.toString() === memberId.toString(),
  );
  if (!isMember) {
    return { error: { status: 404, message: "Thành viên không tồn tại trong nhóm" } };
  }

  const updated = await Conversation.findByIdAndUpdate(
    conversationId,
    {
      $pull: {
        participants: { userId: memberId },
        seenBy: memberId,
      },
      $unset: { [`unreadCounts.${memberId}`]: "" },
    },
    { new: true },
  );

  if (updated) {
    const targetUser = await User.findById(memberId).select("displayName");
    const actorName = user.displayName || (isSelf ? "Một thành viên" : "Chủ nhóm");
    const targetName =
      targetUser?.displayName || (isSelf ? user.displayName : "Một thành viên");

    const systemContent = isSelf
      ? `${actorName} đã rời nhóm`
      : `${targetName} đã bị xóa khỏi nhóm`;

    const systemMessage = await createSystemMessage(updated, user._id, systemContent);
    emitNewMessage(getIo(), updated, systemMessage);
  }
  await invalidateConversationListForUsers(
    [
      memberId,
      ...getConversationParticipantIds(updated),
    ],
    "remove-group-member",
  );
  await invalidateAdminDashboardCache("remove-group-member");

  emitToUser(memberId, "conversation:left", {
    conversationId,
    userId: memberId,
    groupName: conversation.group?.name ?? "Nhóm",
    removedByOther: !isSelf,
  });

  emitToRoom(conversationId, "conversation:member-removed", {
    conversationId,
    memberId,
    participantsCount: updated.participants.length,
  });

  return {
    status: 200,
    payload: {
      message: isSelf ? "Bạn đã rời nhóm" : "Đã xóa thành viên khỏi nhóm",
      succeeded: true,
    },
  };
};

export const uploadGroupAvatarCommand = async ({ user, conversationId, file }) => {
  const userId = user._id.toString();

  if (!file) {
    return { error: { status: 400, message: "Không có file được tải lên" } };
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation || conversation.type !== "group") {
    return {
      error: {
        status: 404,
        message: "Cuộc trò chuyện không tồn tại hoặc không phải nhóm",
      },
    };
  }

  const isMember = conversation.participants.some(
    (participant) => participant.userId.toString() === userId,
  );
  if (!isMember) {
    return { error: { status: 403, message: "Bạn không thuộc cuộc trò chuyện này" } };
  }

  const uploadResult = await uploadImageFromBuffer(file.buffer, {
    folder: "chat_app/group_avatars",
    transformation: [{ width: 256, height: 256, crop: "fill" }],
  });

  const previousAvatarId = conversation.group?.avatarId;
  if (previousAvatarId) {
    await deleteImageFromCloudinary(previousAvatarId).catch((error) => {
      console.error("Không thể xóa avatar nhóm cũ trên Cloudinary:", error);
    });
  }

  conversation.group.avatarUrl = uploadResult.secure_url;
  conversation.group.avatarId = uploadResult.public_id;

  await conversation.save();
  await populateConversationForClient(conversation);

  const formattedConversation = formatConversationForClient(conversation);
  emitToRoom(conversationId, "conversation:updated", {
    conversation: formattedConversation,
  });
  await invalidateConversationListForConversation(
    conversation,
    "update-group-avatar",
  );
  await invalidateAdminDashboardCache("update-group-avatar");

  return {
    status: 200,
    payload: {
      message: "Cập nhật ảnh nhóm thành công",
      conversation: formattedConversation,
    },
  };
};

export const updateGroupNameCommand = async ({ user, conversationId, name }) => {
  const userId = user._id.toString();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return { error: { status: 400, message: "Tên nhóm không được để trống" } };
  }

  if (name.trim().length > 50) {
    return { error: { status: 400, message: "Tên nhóm không được quá 50 ký tự" } };
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation || conversation.type !== "group") {
    return {
      error: {
        status: 404,
        message: "Cuộc trò chuyện không tồn tại hoặc không phải nhóm",
      },
    };
  }

  const isOwner = conversation.group?.createdBy?.toString() === userId;
  if (!isOwner) {
    return { error: { status: 403, message: "Chỉ chủ nhóm mới có thể đổi tên nhóm" } };
  }

  conversation.group.name = name.trim();
  await conversation.save();
  await conversation.populate([
    { path: "participants.userId", select: "displayName avatarUrl email" },
    { path: "group.createdBy", select: "displayName avatarUrl" },
  ]);

  const formattedConversation = formatConversationForClient(conversation);
  emitToRoom(conversationId, "conversation:updated", {
    conversation: formattedConversation,
  });
  await invalidateConversationListForConversation(
    conversation,
    "update-group-name",
  );
  await invalidateAdminDashboardCache("update-group-name");

  return {
    status: 200,
    payload: {
      message: "Cập nhật tên nhóm thành công",
      conversation: formattedConversation,
    },
  };
};

export const emitDirectBlockStatusChanged = async ({
  actorUser,
  blockerUserId,
  targetUserId,
  blockedUserId,
  isBlocked,
}) => {
  const resolvedBlockerId = blockerUserId ?? actorUser?._id;
  const resolvedBlockedUserId = blockedUserId ?? targetUserId;

  if (!resolvedBlockerId || !resolvedBlockedUserId) {
    return;
  }

  const conversation = await findDirectConversationBetweenUsers(
    resolvedBlockerId,
    resolvedBlockedUserId,
  );

  const payload = {
    blockerId: resolvedBlockerId.toString(),
    blockedUserId: resolvedBlockedUserId.toString(),
    isBlocked,
    conversationId: conversation?._id?.toString() ?? null,
  };

  emitToUser(resolvedBlockerId.toString(), "direct:block-status", payload);
  emitToUser(resolvedBlockedUserId.toString(), "direct:block-status", payload);
  await invalidateConversationListForUsers(
    [resolvedBlockerId, resolvedBlockedUserId],
    "direct-block-status",
  );
  await invalidateAdminDashboardCache("direct-block-status");
};
