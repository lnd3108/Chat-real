import Conversation from "../../../models/Conversation.js";
import Message from "../../../models/Message.js";
import User from "../../../models/User.js";
import {
  deleteImageFromCloudinary,
  deleteImageFromCloudinaryUrl,
  uploadImageFromBuffer,
} from "../../../middlewares/uploadMiddleWare.js";
import { ensureDirectMessagingAllowed } from "../../../utils/blocking.js";
import {
  buildDeletedSenderSnapshot,
  emitMessageUpdated,
  emitNewMessage,
  syncConversationLastMessage,
  updateConversationAfterCreateMessage,
} from "../../../utils/messageHelper.js";
import { getIo, isConversationActiveForUser } from "../../../socket/index.js";

const RECALL_PLACEHOLDER = "Ban da xoa mot tin nhan";

export const normalizeMessageForClient = (message, viewerId) => {
  if (!message) return null;

  const normalized = message.toObject ? message.toObject() : { ...message };
  const currentUserId = viewerId?.toString();
  const deletedFor = (normalized.deletedFor || []).map((item) =>
    item?.toString ? item.toString() : String(item),
  );

  return {
    ...normalized,
    senderId: normalized.senderId ?? null,
    senderDeleted: Boolean(normalized.senderDeleted || !normalized.senderId),
    senderDisplayName: normalized.senderDisplayName ?? null,
    senderAvatar: normalized.senderAvatar ?? null,
    deletedFor,
    isHiddenForMe: currentUserId ? deletedFor.includes(currentUserId) : false,
    reactions: (normalized.reactions || []).map((reaction) => ({
      emoji: reaction.emoji,
      userIds: (reaction.userIds || []).map((userId) => userId.toString()),
    })),
  };
};

const buildReplySnapshot = async (conversationId, replyToMessageId) => {
  if (!replyToMessageId) return null;

  const replyMessage = await Message.findOne({
    _id: replyToMessageId,
    conversationId,
  }).lean();

  if (!replyMessage) {
    return null;
  }

  return {
    messageId: replyMessage._id,
    senderId: replyMessage.senderId ?? null,
    senderDeleted: Boolean(replyMessage.senderDeleted || !replyMessage.senderId),
    senderDisplayName:
      replyMessage.senderDeleted || !replyMessage.senderId
        ? replyMessage.senderDisplayName ?? buildDeletedSenderSnapshot().senderDisplayName
        : (replyMessage.senderDisplayName ?? null),
    senderAvatar:
      replyMessage.senderDeleted || !replyMessage.senderId
        ? replyMessage.senderAvatar ?? null
        : (replyMessage.senderAvatar ?? null),
    isDeletedForEveryone: !!replyMessage.isDeletedForEveryone,
    content: replyMessage.isDeletedForEveryone
      ? RECALL_PLACEHOLDER
      : (replyMessage.content ?? null),
    imgUrl: replyMessage.isDeletedForEveryone ? null : (replyMessage.imgUrl ?? null),
    type: replyMessage.type ?? "user",
  };
};

const buildConversationSocketPayload = async (conversation) => {
  await conversation.populate({
    path: "participants.userId",
    select: "userName displayName avatarUrl bio",
  });

  return {
    _id: conversation._id,
    type: conversation.type,
    group: conversation.group ?? null,
    participants: (conversation.participants || []).map((participant) => ({
      _id: participant.userId?._id,
      userName: participant.userId?.userName,
      displayName: participant.userId?.displayName,
      avatarUrl: participant.userId?.avatarUrl ?? null,
      bio: participant.userId?.bio ?? null,
      joinedAt: participant.joinedAt,
    })),
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt,
    seenBy: conversation.seenBy || [],
    unreadCounts: Object.fromEntries(conversation.unreadCounts || []),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

export const createAndEmitMessage = async ({
  conversation,
  conversationId,
  senderId,
  senderDisplayName,
  senderAvatar,
  content,
  file,
  replyToMessageId,
  includeConversationPayload = false,
}) => {
  let imgUrl = null;
  let imgPublicId = null;

  if (file) {
    const result = await uploadImageFromBuffer(file.buffer, {
      folder: "chat_app/messages",
      transformation: [{ width: 1600, height: 1600, crop: "limit" }],
    });
    imgUrl = result.secure_url;
    imgPublicId = result.public_id;
  }

  const normalizedContent = content?.trim() || null;
  const replyTo = await buildReplySnapshot(conversationId, replyToMessageId);

  const message = await Message.create({
    conversationId,
    senderId,
    senderDeleted: false,
    senderDisplayName: senderDisplayName ?? null,
    senderAvatar: senderAvatar ?? null,
    content: normalizedContent,
    imgUrl,
    imgPublicId,
    replyTo,
  });

  updateConversationAfterCreateMessage(conversation, message, senderId, {
    isConversationActive: (memberId) =>
      isConversationActiveForUser(memberId, conversationId),
  });
  await conversation.save();

  const conversationPayload = includeConversationPayload
    ? await buildConversationSocketPayload(conversation)
    : undefined;

  emitNewMessage(getIo(), conversation, message, conversationPayload);

  return { message, conversationPayload: conversationPayload ?? null };
};

export const sendDirectMessageCommand = async ({
  user,
  body,
  file,
}) => {
  const { recipientId, content, conversationId, replyToMessageId } = body;
  const senderId = user._id;

  if (!content?.trim() && !file) {
    return { error: { status: 400, message: "Thieu noi dung" } };
  }

  let conversation = null;
  const recipientUser = await User.findById(recipientId).select("blockedUsers");
  if (!recipientUser) {
    return { error: { status: 404, message: "Nguoi dung khong ton tai" } };
  }

  const directPermission = ensureDirectMessagingAllowed({
    senderUser: user,
    recipientUser,
    senderId,
    recipientId,
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

  if (conversationId) {
    conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return { error: { status: 404, message: "Cuoc tro chuyen khong ton tai" } };
    }

    if (conversation.type !== "direct") {
      return {
        error: {
          status: 400,
          message: "Chi ho tro gui direct vao cuoc tro chuyen 1-1",
        },
      };
    }

    const memberIds = conversation.participants.map((participant) =>
      participant.userId.toString(),
    );
    const isValidDirectConversation =
      memberIds.includes(senderId.toString()) &&
      memberIds.includes(recipientId.toString()) &&
      memberIds.length === 2;

    if (!isValidDirectConversation) {
      return {
        error: {
          status: 403,
          message: "Ban khong the gui tin nhan vao cuoc tro chuyen direct nay",
        },
      };
    }
  }

  if (!conversation) {
    conversation = await Conversation.create({
      type: "direct",
      participants: [
        { userId: senderId, joinedAt: new Date() },
        { userId: recipientId, joinedAt: new Date() },
      ],
      lastMessageAt: new Date(),
    });
  }

  const { message, conversationPayload } = await createAndEmitMessage({
    conversation,
    conversationId: conversation._id,
    senderId,
    senderDisplayName: user.displayName ?? null,
    senderAvatar: user.avatarUrl ?? null,
    content,
    file,
    replyToMessageId,
    includeConversationPayload: true,
  });

  return {
    status: 201,
    payload: {
      message: normalizeMessageForClient(message, senderId),
      conversation: conversationPayload,
    },
  };
};

export const sendGroupMessageCommand = async ({
  user,
  conversation,
  body,
  file,
}) => {
  const { conversationId, content, replyToMessageId } = body;
  const senderId = user._id;

  if (!content?.trim() && !file) {
    return { error: { status: 400, message: "Thieu noi dung" } };
  }

  const { message } = await createAndEmitMessage({
    conversation,
    conversationId,
    senderId,
    senderDisplayName: user.displayName ?? null,
    senderAvatar: user.avatarUrl ?? null,
    content,
    file,
    replyToMessageId,
  });

  return {
    status: 201,
    payload: {
      message: normalizeMessageForClient(message, senderId),
    },
  };
};

export const syncConversationAndEmitUpdate = async (conversation, message) => {
  const latestMessage =
    message ??
    (await Message.findOne({
      conversationId: conversation._id,
      $or: [
        { isDeletedForEveryone: false },
        { isDeletedForEveryone: { $exists: false } },
      ],
    }).sort({ createdAt: -1 }));

  syncConversationLastMessage(conversation, latestMessage);
  await conversation.save();

  return latestMessage;
};

export const clearMessageAssets = async (message) => {
  const currentImgPublicId = message.imgPublicId;
  const currentImgUrl = message.imgUrl;

  if (!currentImgPublicId && !currentImgUrl) {
    return;
  }

  const deleteImagePromise = currentImgPublicId
    ? deleteImageFromCloudinary(currentImgPublicId)
    : deleteImageFromCloudinaryUrl(currentImgUrl);

  await deleteImagePromise.catch((deleteError) => {
    console.error("Khong the xoa anh tin nhan tren Cloudinary:", deleteError);
  });
};

export const emitExistingMessageUpdated = (conversation, message) => {
  emitMessageUpdated(getIo(), conversation, message);
};
