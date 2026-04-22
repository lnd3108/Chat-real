import Conversation from "../../../models/Conversation.js";
import Message from "../../../models/Message.js";
import User from "../../../models/User.js";

export const buildTargetUserSnapshot = async (targetType, targetUserId) => {
  if (targetType !== "user" || !targetUserId) return null;
  const targetUser = await User.findById(targetUserId).lean();
  if (!targetUser) return null;

  return {
    _id: targetUser._id,
    displayName: targetUser.displayName,
    userName: targetUser.userName,
    email: targetUser.email,
    avatarUrl: targetUser.avatarUrl,
  };
};

export const buildTargetMessagePreview = async (targetType, targetMessageId) => {
  if (targetType !== "message" || !targetMessageId) return null;

  const message = await Message.findById(targetMessageId)
    .select("content imgUrl senderId senderDisplayName senderDeleted createdAt")
    .lean();

  if (!message) return null;

  return {
    _id: message._id,
    content: message.content,
    imgUrl: message.imgUrl,
    senderDisplayName: message.senderDisplayName,
    senderUserName: message.senderUserName,
    createdAt: message.createdAt,
  };
};

export const buildTargetConversationSnapshot = async (targetType, targetConversationId) => {
  if (targetType !== "conversation" || !targetConversationId) return null;

  const conversation = await Conversation.findById(targetConversationId)
    .select("type groupName members createdAt")
    .lean();

  if (!conversation) return null;

  return {
    _id: conversation._id,
    type: conversation.type,
    groupName: conversation.groupName,
    membersCount: conversation.members ? conversation.members.length : 0,
  };
};
