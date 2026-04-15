import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import {
  emitNewMessage,
  updateConversationAfterCreateMessage,
} from "../utils/messageHelper.js";
import { getIo } from "../socket/index.js";
import { uploadImageFromBuffer } from "../middlewares/uploadMiddleWare.js";

// Controller xử lý gửi tin nhắn trực tiếp và nhóm
export const sendDirectMessage = async (req, res) => {
  try {
    const { recipientId, content, conversationId } = req.body;
    const senderId = req.user._id;

    let conversation;

    if (!content) {
      return res.status(400).json({ message: "Thiếu nội dung" });
    }

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

    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      content,
    });

    updateConversationAfterCreateMessage(conversation, message, senderId);
    const io = getIo();
    await conversation.save();

    emitNewMessage(io, conversation, message);

    return res.status(201).json({ message });
  } catch (error) {
    console.error("Lỗi xảy ra khi gửi tin nhắn trực tiếp", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Controller xử lý gửi tin nhắn trong nhóm
export const sendGroupMessage = async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const senderId = req.user._id;
    const conversation = req.conversation;

    if (!content) {
      return res.status(400).json("Thiếu nội dung");
    }

    const message = await Message.create({
      conversationId,
      senderId,
      content,
    });

    updateConversationAfterCreateMessage(conversation, message, senderId);

    await conversation.save();
    const io = getIo();
    emitNewMessage(io, conversation, message);

    return res.status(201).json({ message });
  } catch (error) {
    console.error("Lỗi xảy ra khi gửi tin nhắn nhóm", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const sendMessageWithImage = async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const senderId = req.user._id;
    const file = req.file;

    if(!conversationId){
      return res.status(400).json({
        message: "Thiếu conversationId"
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if(!conversation){
      return res.status(404).json({
        message: "Cuộc trò chuyện không tồn tại"
      });
    }

    const isMember = conversation.participants.some(
      p => p.userId.toString() === senderId.toString()
    );

    if(!isMember){
      return res.status(403).json({
        message: "Bạn không phải là thành viên của cuộc trò chuyện này"
      })
    }

    let imgUrl = null;
    if(file){
      const result = await uploadImageFromBuffer(file.buffer);
      imgUrl = result.secure_url;
    }

    const message = await Message.create({
      conversationId,
      senderId,
      content: content || null,
      imgUrl,
    })
    
    updateConversationAfterCreateMessage(conversation, message, senderId);

    await conversation.save();
    const io = getIo();
    emitNewMessage(io, conversation, message);

    return res.status(201).json({ message });
  } catch (error) {
    console.error("Lỗi xảy ra khi gửi tin nhắn có hình ảnh", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
