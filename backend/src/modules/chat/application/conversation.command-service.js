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

const createSystemMessage = async (conversation, actorId, content) => {
  const message = await Message.create({
    conversationId: conversation._id,
    senderId: actorId,
    type: "system",
    content,
  });

  updateConversationAfterCreateMessage(conversation, message, actorId);
  await conversation.save();

  return message;
};

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
        message: "Ten nhom va danh sach thanh vien la bat buoc",
      },
    };
  }

  let conversation;

  if (type === "direct") {
    const participantId = memberIds[0];
    const participantUser = await User.findById(participantId).select("blockedUsers");

    if (!participantUser) {
      return { error: { status: 404, message: "Nguoi dung khong ton tai" } };
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
    return { error: { status: 400, message: "Conversation type khong hop le" } };
  }

  await populateConversationForClient(conversation);
  const formatted = attachBlockInfoToConversation(
    formatConversationForClient(conversation),
    user,
  );

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

export const markConversationSeenCommand = async ({ conversationId, userId }) => {
  const normalizedUserId = userId.toString();
  const conversation = await Conversation.findById(conversationId).lean();

  if (!conversation) {
    return { error: { status: 404, message: "Conversation khong ton tai " } };
  }

  const last = conversation.lastMessage;
  if (!last) {
    return { status: 200, payload: { message: "Khong co tin nhan de mark as seen" } };
  }

  if (!last.senderId || last.senderId.toString() === normalizedUserId) {
    return { status: 200, payload: { message: "Sender khong can mark as seen" } };
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

  return {
    status: 200,
    payload: {
      message: "Da xoa lich su chat o phia ban",
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
    return { error: { status: 404, message: "Conversation khong ton tai" } };
  }

  if (conversation.type !== "group" && conversation.type !== "direct") {
    return { error: { status: 400, message: "Chi ap dung cho nhom (group)" } };
  }

  const isMember = conversation.participants?.some((p) => p.userId.toString() === userId);
  if (!isMember) {
    return { error: { status: 403, message: "Ban khong thuoc cuoc tro chuyen nay" } };
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

    return {
      status: 200,
      payload: {
        message: "Da xoa nhom thanh cong",
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
      `${user.displayName || "Mot thanh vien"} da roi nhom`,
    );
    emitNewMessage(getIo(), updated, systemMessage);
  }

  emitToUser(userId, "conversation:left", {
    conversationId,
    userId,
    groupName: conversation.group?.name ?? "Nhom",
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
      message: "Ban da roi nhom va cuoc tro chuyen da duoc xoa o phia ban",
      deleted: false,
      left: true,
    },
  };
};

export const addGroupMembersCommand = async ({ user, conversationId, memberIds }) => {
  const userId = user._id.toString();

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return { error: { status: 400, message: "memberIds phai la array khong rong" } };
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation || conversation.type !== "group") {
    return {
      error: {
        status: 404,
        message: "Cuoc tro chuyen khong ton tai hoac khong phai nhom",
      },
    };
  }

  const isOwner = conversation.group?.createdBy?.toString() === userId.toString();
  if (!isOwner) {
    return { error: { status: 403, message: "Chi chu nhom moi co the them thanh vien" } };
  }

  const existing = new Set(conversation.participants.map((p) => p.userId.toString()));
  const newMemberIds = memberIds.filter((id) => !existing.has(id.toString()));

  if (newMemberIds.length === 0) {
    return { error: { status: 400, message: "Tat ca thanh vien da co trong nhom" } };
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
      `${addedUser.displayName || "Mot thanh vien"} vua tham gia cuoc hoi thoai`,
    );
    emitNewMessage(getIo(), updated, systemMessage);
  }

  const populatedConversation = await Conversation.findById(conversationId).populate([
    { path: "participants.userId", select: "displayName avatarUrl" },
    { path: "group.createdBy", select: "displayName avatarUrl" },
  ]);

  if (!populatedConversation) {
    return { error: { status: 404, message: "Cuoc tro chuyen khong ton tai" } };
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

  return {
    status: 200,
    payload: {
      message: "Them thanh vien thanh cong",
      conversation: populatedConversation,
    },
  };
};

export const removeGroupMemberCommand = async ({ user, conversationId, memberId }) => {
  const userId = user._id.toString();

  if (!memberId) {
    return { error: { status: 400, message: "memberId la bat buoc" } };
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation || conversation.type !== "group") {
    return {
      error: {
        status: 404,
        message: "Cuoc tro chuyen khong ton tai hoac khong phai nhom",
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
          "Chi chu nhom moi co the xoa thanh vien khac, ban chi co the roi nhom",
      },
    };
  }

  const isMember = conversation.participants?.some(
    (p) => p.userId.toString() === memberId.toString(),
  );
  if (!isMember) {
    return { error: { status: 404, message: "Thanh vien khong ton tai trong nhom" } };
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
    const actorName = user.displayName || (isSelf ? "Mot thanh vien" : "Chu nhom");
    const targetName =
      targetUser?.displayName || (isSelf ? user.displayName : "Mot thanh vien");

    const systemContent = isSelf
      ? `${actorName} da roi nhom`
      : `${targetName} da bi xoa khoi nhom`;

    const systemMessage = await createSystemMessage(updated, user._id, systemContent);
    emitNewMessage(getIo(), updated, systemMessage);
  }

  emitToUser(memberId, "conversation:left", {
    conversationId,
    userId: memberId,
    groupName: conversation.group?.name ?? "Nhom",
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
      message: isSelf ? "Ban da roi nhom" : "Da xoa thanh vien khoi nhom",
      succeeded: true,
    },
  };
};

export const uploadGroupAvatarCommand = async ({ user, conversationId, file }) => {
  const userId = user._id.toString();

  if (!file) {
    return { error: { status: 400, message: "Khong co file duoc tai len" } };
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation || conversation.type !== "group") {
    return {
      error: {
        status: 404,
        message: "Cuoc tro chuyen khong ton tai hoac khong phai nhom",
      },
    };
  }

  const isMember = conversation.participants.some(
    (participant) => participant.userId.toString() === userId,
  );
  if (!isMember) {
    return { error: { status: 403, message: "Ban khong thuoc cuoc tro chuyen nay" } };
  }

  const uploadResult = await uploadImageFromBuffer(file.buffer, {
    folder: "chat_app/group_avatars",
    transformation: [{ width: 256, height: 256, crop: "fill" }],
  });

  const previousAvatarId = conversation.group?.avatarId;
  if (previousAvatarId) {
    await deleteImageFromCloudinary(previousAvatarId).catch((error) => {
      console.error("Khong the xoa avatar nhom cu tren Cloudinary:", error);
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

  return {
    status: 200,
    payload: {
      message: "Cap nhat anh nhom thanh cong",
      conversation: formattedConversation,
    },
  };
};

export const updateGroupNameCommand = async ({ user, conversationId, name }) => {
  const userId = user._id.toString();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return { error: { status: 400, message: "Ten nhom khong duoc de trong" } };
  }

  if (name.trim().length > 50) {
    return { error: { status: 400, message: "Ten nhom khong duoc qua 50 ky tu" } };
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation || conversation.type !== "group") {
    return {
      error: {
        status: 404,
        message: "Cuoc tro chuyen khong ton tai hoac khong phai nhom",
      },
    };
  }

  const isOwner = conversation.group?.createdBy?.toString() === userId;
  if (!isOwner) {
    return { error: { status: 403, message: "Chi chu nhom moi co the doi ten nhom" } };
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

  return {
    status: 200,
    payload: {
      message: "Cap nhat ten nhom thanh cong",
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
};
