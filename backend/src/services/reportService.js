import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

const REPORT_TARGET_TYPES = ["user", "message", "conversation"];

export const validateReportInput = ({ targetType, reason, description }) => {
  if (!targetType || !REPORT_TARGET_TYPES.includes(targetType)) {
    return "Invalid targetType";
  }

  if (!reason || reason.trim().length === 0) {
    return "Reason is required";
  }

  if (reason.trim().length > 500) {
    return "Reason must be less than 500 characters";
  }

  if (description && description.length > 2000) {
    return "Description must be less than 2000 characters";
  }

  return null;
};

export const validateReportTarget = async ({
  reporterId,
  targetType,
  targetUserId,
  targetMessageId,
  targetConversationId,
}) => {
  if (targetType === "user") {
    if (!targetUserId) {
      return { status: 400, message: "targetUserId is required for user reports" };
    }

    if (reporterId.toString() === targetUserId.toString()) {
      return { status: 400, message: "Cannot report yourself" };
    }

    const targetUser = await User.findById(targetUserId).lean();
    if (!targetUser) {
      return { status: 404, message: "Target user not found" };
    }
  }

  if (targetType === "message") {
    if (!targetMessageId) {
      return { status: 400, message: "targetMessageId is required for message reports" };
    }

    const message = await Message.findById(targetMessageId).lean();
    if (!message) {
      return { status: 404, message: "Target message not found" };
    }
  }

  if (targetType === "conversation") {
    if (!targetConversationId) {
      return {
        status: 400,
        message: "targetConversationId is required for conversation reports",
      };
    }

    const conversation = await Conversation.findById(targetConversationId).lean();
    if (!conversation) {
      return { status: 404, message: "Target conversation not found" };
    }
  }

  return null;
};

export const buildReporterSnapshot = (user) => ({
  _id: user._id,
  displayName: user.displayName,
  userName: user.userName,
  avatarUrl: user.avatarUrl,
});

export const buildTargetUserSnapshot = async (targetType, targetUserId) => {
  if (targetType !== "user" || !targetUserId) {
    return null;
  }

  const targetUser = await User.findById(targetUserId).lean();
  if (!targetUser) {
    return null;
  }

  return {
    _id: targetUser._id,
    displayName: targetUser.displayName,
    userName: targetUser.userName,
    email: targetUser.email,
    avatarUrl: targetUser.avatarUrl,
  };
};

export const buildTargetMessagePreview = async (targetType, targetMessageId) => {
  if (targetType !== "message" || !targetMessageId) {
    return null;
  }

  const message = await Message.findById(targetMessageId)
    .select("content imgUrl senderId senderDisplayName senderDeleted createdAt")
    .lean();

  if (!message) {
    return null;
  }

  return {
    _id: message._id,
    content: message.content,
    imgUrl: message.imgUrl,
    senderDisplayName: message.senderDisplayName,
    senderUserName: message.senderUserName,
    createdAt: message.createdAt,
  };
};

export const buildTargetConversationSnapshot = async (
  targetType,
  targetConversationId,
) => {
  if (targetType !== "conversation" || !targetConversationId) {
    return null;
  }

  const conversation = await Conversation.findById(targetConversationId)
    .select("type groupName members createdAt")
    .lean();

  if (!conversation) {
    return null;
  }

  return {
    _id: conversation._id,
    type: conversation.type,
    groupName: conversation.groupName,
    membersCount: conversation.members ? conversation.members.length : 0,
  };
};
