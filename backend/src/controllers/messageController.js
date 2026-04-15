import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import {
  emitMessageUpdated,
  emitNewMessage,
  syncConversationLastMessage,
  updateConversationAfterCreateMessage,
} from "../utils/messageHelper.js";
import { getIo } from "../socket/index.js";
import { uploadImageFromBuffer } from "../middlewares/uploadMiddleWare.js";

const RECALL_PLACEHOLDER = "Ban da xoa mot tin nhan";

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
    content: replyMessage.isDeletedForEveryone
      ? RECALL_PLACEHOLDER
      : (replyMessage.content ?? null),
    imgUrl: replyMessage.isDeletedForEveryone ? null : (replyMessage.imgUrl ?? null),
    type: replyMessage.type ?? "user",
  };
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

const createAndEmitMessage = async ({
  conversation,
  conversationId,
  senderId,
  content,
  file,
  replyToMessageId,
}) => {
  let imgUrl = null;

  if (file) {
    const result = await uploadImageFromBuffer(file.buffer, {
      folder: "chat_app/messages",
      transformation: [{ width: 1600, height: 1600, crop: "limit" }],
    });
    imgUrl = result.secure_url;
  }

  const normalizedContent = content?.trim() || null;
  const replyTo = await buildReplySnapshot(conversationId, replyToMessageId);

  const message = await Message.create({
    conversationId,
    senderId,
    content: normalizedContent,
    imgUrl,
    replyTo,
  });

  updateConversationAfterCreateMessage(conversation, message, senderId);
  await conversation.save();

  const io = getIo();
  emitNewMessage(io, conversation, message);

  return message;
};

const ensureConversationMember = async (conversationId, userId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return { error: { status: 404, message: "Conversation khong ton tai" } };
  }

  const isMember = conversation.participants.some(
    (participant) => participant.userId.toString() === userId.toString(),
  );

  if (!isMember) {
    return { error: { status: 403, message: "Ban khong thuoc cuoc tro chuyen nay" } };
  }

  return { conversation };
};

const loadMessageContext = async (messageId, userId) => {
  const message = await Message.findById(messageId);
  if (!message) {
    return { error: { status: 404, message: "Tin nhan khong ton tai" } };
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
      return res.status(400).json({ message: "Thieu noi dung" });
    }

    let conversation = null;

    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
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

    const message = await createAndEmitMessage({
      conversation,
      conversationId: conversation._id,
      senderId,
      content,
      file,
      replyToMessageId,
    });

    return res
      .status(201)
      .json({ message: normalizeMessageForClient(message, senderId) });
  } catch (error) {
    console.error("Loi xay ra khi gui tin nhan truc tiep", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { conversationId, content, replyToMessageId } = req.body;
    const senderId = req.user._id;
    const conversation = req.conversation;
    const file = req.file;

    if (!content?.trim() && !file) {
      return res.status(400).json({ message: "Thieu noi dung" });
    }

    const message = await createAndEmitMessage({
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
    console.error("Loi xay ra khi gui tin nhan nhom", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    if (!content?.trim()) {
      return res.status(400).json({ message: "Noi dung khong duoc de trong" });
    }

    const { message, conversation, error } = await loadMessageContext(
      messageId,
      userId,
    );
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    if (message.type === "system") {
      return res.status(400).json({ message: "Khong the sua tin nhan he thong" });
    }

    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Ban khong the sua tin nhan nay" });
    }

    if (message.isDeletedForEveryone) {
      return res.status(400).json({ message: "Tin nhan da thu hoi" });
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
    console.error("Loi khi sua tin nhan", error);
    return res.status(500).json({ message: "Loi he thong" });
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
    console.error("Loi khi thu hoi tin nhan phia minh", error);
    return res.status(500).json({ message: "Loi he thong" });
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
      return res.status(400).json({ message: "Khong the thu hoi tin nhan he thong" });
    }

    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Ban khong the thu hoi tin nhan nay" });
    }

    message.content = null;
    message.imgUrl = null;
    message.replyTo = null;
    message.reactions = [];
    message.isDeletedForEveryone = true;
    message.editedAt = null;
    await message.save();

    if (conversation.lastMessage?._id?.toString() === message._id.toString()) {
      await syncConversationAndEmitUpdate(conversation, message);
    }

    emitMessageUpdated(getIo(), conversation, message);

    return res
      .status(200)
      .json({ message: normalizeMessageForClient(message, userId) });
  } catch (error) {
    console.error("Loi khi thu hoi tin nhan cho tat ca", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const toggleReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji?.trim()) {
      return res.status(400).json({ message: "Emoji la bat buoc" });
    }

    const { message, conversation, error } = await loadMessageContext(
      messageId,
      userId,
    );
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    if (message.isDeletedForEveryone) {
      return res.status(400).json({ message: "Khong the reaction vao tin nhan da thu hoi" });
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
    console.error("Loi khi reaction tin nhan", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const sendMessageWithImage = sendGroupMessage;


