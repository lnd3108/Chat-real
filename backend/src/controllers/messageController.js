import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import {
  emitNewMessage,
  updateConversationAfterCreateMessage,
} from "../utils/messageHelper.js";
import { getIo } from "../socket/index.js";
import { uploadImageFromBuffer } from "../middlewares/uploadMiddleWare.js";

const createAndEmitMessage = async ({
  conversation,
  conversationId,
  senderId,
  content,
  file,
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

  const message = await Message.create({
    conversationId,
    senderId,
    content: normalizedContent,
    imgUrl,
  });

  updateConversationAfterCreateMessage(conversation, message, senderId);
  await conversation.save();

  const io = getIo();
  emitNewMessage(io, conversation, message);

  return message;
};

export const sendDirectMessage = async (req, res) => {
  try {
    const { recipientId, content, conversationId } = req.body;
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
    });

    return res.status(201).json({ message });
  } catch (error) {
    console.error("Loi xay ra khi gui tin nhan truc tiep", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { conversationId, content } = req.body;
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
    });

    return res.status(201).json({ message });
  } catch (error) {
    console.error("Loi xay ra khi gui tin nhan nhom", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const sendMessageWithImage = sendGroupMessage;


