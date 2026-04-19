import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import {
  emitMessageUpdated,
  emitNewMessage,
  syncConversationLastMessage,
  updateConversationAfterCreateMessage,
} from "../utils/messageHelper.js";
import { getIo, isConversationActiveForUser } from "../socket/index.js";
import { ensureDirectMessagingAllowed } from "../utils/blocking.js";
import {
  deleteImageFromCloudinary,
  deleteImageFromCloudinaryUrl,
  uploadImageFromBuffer,
} from "../middlewares/uploadMiddleWare.js";

const RECALL_PLACEHOLDER = "Bạn đã xóa một tin nhắn";

const normalizeMessageForClient = (message, viewerId) => {
  if (!message) return null;

  const normalized = message.toObject ? message.toObject() : { ...message };
  const currentUserId = viewerId?.toString();
  const deletedFor = (normalized.deletedFor || []).map((item) =>
    item?.toString ? item.toString() : String(item),
  );

  return {
    ...normalized,
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
    senderId: replyMessage.senderId,
    isDeletedForEveryone: !!replyMessage.isDeletedForEveryone,
    content: replyMessage.isDeletedForEveryone
      ? RECALL_PLACEHOLDER
      : (replyMessage.content ?? null),
    imgUrl: replyMessage.isDeletedForEveryone ? null : (replyMessage.imgUrl ?? null),
    type: replyMessage.type ?? "user",
  };
};

const syncReplySnapshotsAfterRecall = async (conversation, recalledMessage) => {
  const impactedMessages = await Message.find({
    conversationId: conversation._id,
    "replyTo.messageId": recalledMessage._id,
  });

  if (impactedMessages.length === 0) return;

  const io = getIo();

  for (const impactedMessage of impactedMessages) {
    if (!impactedMessage.replyTo) continue;

    impactedMessage.replyTo.content = RECALL_PLACEHOLDER;
    impactedMessage.replyTo.imgUrl = null;
    impactedMessage.replyTo.isDeletedForEveryone = true;

    await impactedMessage.save();
    emitMessageUpdated(io, conversation, impactedMessage);
  }
};

const findLatestVisibleMessage = async (conversationId) =>
  Message.findOne({
    conversationId,
    $or: [
      { isDeletedForEveryone: false },
      { isDeletedForEveryone: { $exists: false } },
    ],
  }).sort({ createdAt: -1 });

const syncConversationAndEmitUpdate = async (conversation, message) => {
  const latestMessage =
    message ??
    (await findLatestVisibleMessage(conversation._id));

  syncConversationLastMessage(conversation, latestMessage);
  await conversation.save();

  return latestMessage;
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

const createAndEmitMessage = async ({
  conversation,
  conversationId,
  senderId,
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

  const io = getIo();
  emitNewMessage(io, conversation, message, conversationPayload);

  return { message, conversationPayload: conversationPayload ?? null };
};

const ensureConversationMember = async (conversationId, userId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return { error: { status: 404, message: "Cuộc trò chuyện không tồn tại" } };
  }

  const isMember = conversation.participants.some(
    (participant) => participant.userId.toString() === userId.toString(),
  );

  if (!isMember) {
    return { error: { status: 403, message: "Bạn không thuộc cuộc trò chuyện này" } };
  }

  return { conversation };
};

const loadMessageContext = async (messageId, userId) => {
  const message = await Message.findById(messageId);
  if (!message) {
    return { error: { status: 404, message: "Tin nhắn không tồn tại" } };
  }

  const { conversation, error } = await ensureConversationMember(
    message.conversationId,
    userId,
  );

  if (error) {
    return { error };
  }

  return { message, conversation };
};

export const sendDirectMessage = async (req, res) => {
  try {
    const { recipientId, content, conversationId, replyToMessageId } = req.body;
    const senderId = req.user._id;
    const file = req.file;

    if (!content?.trim() && !file) {
      return res.status(400).json({ message: "Thiếu nội dung" });
    }

    let conversation = null;
    let isNewConversation = false;
    const recipientUser = await User.findById(recipientId).select("blockedUsers");

    if (!recipientUser) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const directPermission = ensureDirectMessagingAllowed({
      senderUser: req.user,
      recipientUser,
      senderId,
      recipientId,
    });

    if (!directPermission.allowed) {
      return res.status(directPermission.status).json({
        message: directPermission.message,
        code: directPermission.code,
      });
    }

    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Cuộc trò chuyện không tồn tại" });
      }

      if (conversation.type !== "direct") {
        return res.status(400).json({ message: "Chỉ hỗ trợ gửi direct vào cuộc trò chuyện 1-1" });
      }

      const memberIds = conversation.participants.map((participant) =>
        participant.userId.toString(),
      );
      const isValidDirectConversation =
        memberIds.includes(senderId.toString()) &&
        memberIds.includes(recipientId.toString()) &&
        memberIds.length === 2;

      if (!isValidDirectConversation) {
        return res.status(403).json({
          message: "Bạn không thể gửi tin nhắn vào cuộc trò chuyện direct này",
        });
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
      isNewConversation = true;
    }

    const { message, conversationPayload } = await createAndEmitMessage({
      conversation,
      conversationId: conversation._id,
      senderId,
      content,
      file,
      replyToMessageId,
      includeConversationPayload: true,
    });

    return res
      .status(201)
      .json({
        message: normalizeMessageForClient(message, senderId),
        conversation: conversationPayload,
      });
  } catch (error) {
    console.error("Lỗi xảy ra khi gửi tin nhắn trực tiếp", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { conversationId, content, replyToMessageId } = req.body;
    const senderId = req.user._id;
    const conversation = req.conversation;
    const file = req.file;

    if (!content?.trim() && !file) {
      return res.status(400).json({ message: "Thiếu nội dung" });
    }

    const { message } = await createAndEmitMessage({
      conversation,
      conversationId,
      senderId,
      content,
      file,
      replyToMessageId,
    });

    return res
      .status(201)
      .json({ message: normalizeMessageForClient(message, senderId) });
  } catch (error) {
    console.error("Lỗi xảy ra khi gửi tin nhắn nhóm", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    if (!content?.trim()) {
      return res.status(400).json({ message: "Nội dung không được để trống" });
    }

    const { message, conversation, error } = await loadMessageContext(
      messageId,
      userId,
    );
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    if (message.type === "system") {
      return res.status(400).json({ message: "Không thể sửa tin nhắn hệ thống" });
    }

    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Bạn không thể sửa tin nhắn này" });
    }

    if (message.isDeletedForEveryone) {
      return res.status(400).json({ message: "Tin nhắn đã bị thu hồi" });
    }

    message.content = content.trim();
    message.editedAt = new Date();
    await message.save();

    if (conversation.lastMessage?._id?.toString() === message._id.toString()) {
      await syncConversationAndEmitUpdate(conversation, message);
    }

    emitMessageUpdated(getIo(), conversation, message);

    return res
      .status(200)
      .json({ message: normalizeMessageForClient(message, userId) });
  } catch (error) {
    console.error("Lỗi khi sửa tin nhắn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const deleteMessageForMe = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const { message, error } = await loadMessageContext(messageId, userId);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const alreadyDeleted = message.deletedFor.some(
      (item) => item.toString() === userId.toString(),
    );

    if (!alreadyDeleted) {
      message.deletedFor.push(userId);
      await message.save();
    }

    getIo().to(userId.toString()).emit("message:removed-for-me", {
      conversationId: message.conversationId.toString(),
      messageId: message._id.toString(),
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Lỗi khi thu hồi tin nhắn phía mình", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const deleteMessageForEveryone = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const { message, conversation, error } = await loadMessageContext(
      messageId,
      userId,
    );
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    if (message.type === "system") {
      return res.status(400).json({ message: "Không thể thu hồi tin nhắn hệ thống" });
    }

    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Bạn không thể thu hồi tin nhắn này" });
    }

    const currentImgPublicId = message.imgPublicId;
    const currentImgUrl = message.imgUrl;

    if (currentImgPublicId || currentImgUrl) {
      const deleteImagePromise = currentImgPublicId
        ? deleteImageFromCloudinary(currentImgPublicId)
        : deleteImageFromCloudinaryUrl(currentImgUrl);

      await deleteImagePromise.catch((deleteError) => {
        console.error("KhÃ´ng thá»ƒ xÃ³a áº£nh tin nháº¯n trÃªn Cloudinary:", deleteError);
      });
    }

    message.content = null;
    message.imgUrl = null;
    message.imgPublicId = null;
    message.replyTo = null;
    message.reactions = [];
    message.isDeletedForEveryone = true;
    message.editedAt = null;
    await message.save();

    await syncReplySnapshotsAfterRecall(conversation, message);

    if (conversation.lastMessage?._id?.toString() === message._id.toString()) {
      await syncConversationAndEmitUpdate(conversation, message);
    }

    emitMessageUpdated(getIo(), conversation, message);

    return res
      .status(200)
      .json({ message: normalizeMessageForClient(message, userId) });
  } catch (error) {
    console.error("Lỗi khi thu hồi tin nhắn cho tất cả", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const toggleReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji?.trim()) {
      return res.status(400).json({ message: "Emoji là bắt buộc" });
    }

    const { message, conversation, error } = await loadMessageContext(
      messageId,
      userId,
    );
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    if (message.isDeletedForEveryone) {
      return res.status(400).json({ message: "Không thể thả biểu cảm vào tin nhắn đã thu hồi" });
    }

    const reaction = message.reactions.find((item) => item.emoji === emoji);
    if (!reaction) {
      message.reactions.push({ emoji, userIds: [userId] });
    } else {
      const exists = reaction.userIds.some(
        (item) => item.toString() === userId.toString(),
      );

      reaction.userIds = exists
        ? reaction.userIds.filter((item) => item.toString() !== userId.toString())
        : [...reaction.userIds, userId];

      message.reactions = message.reactions.filter(
        (item) => item.userIds.length > 0,
      );
    }

    await message.save();
    emitMessageUpdated(getIo(), conversation, message);

    return res
      .status(200)
      .json({ message: normalizeMessageForClient(message, userId) });
  } catch (error) {
    console.error("Lỗi khi thả biểu cảm vào tin nhắn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const sendMessageWithImage = sendGroupMessage;


