import Conversation from "../../../models/Conversation.js";
import Message from "../../../models/Message.js";
import User from "../../../models/User.js";

export const REPORT_TARGET_TYPES = ["user", "message", "conversation"];

export const validateReportInput = ({ targetType, reason, description }) => {
  if (!targetType || !REPORT_TARGET_TYPES.includes(targetType)) {
    return "Loai doi tuong bao cao khong hop le";
  }

  if (!reason || reason.trim().length === 0) {
    return "Vui long nhap ly do bao cao";
  }

  if (reason.trim().length > 500) {
    return "Ly do bao cao khong duoc vuot qua 500 ky tu";
  }

  if (description && description.length > 2000) {
    return "Mo ta chi tiet khong duoc vuot qua 2000 ky tu";
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
    if (!targetUserId) return { status: 400, message: "Thieu nguoi dung bi bao cao" };
    if (reporterId.toString() === targetUserId.toString()) {
      return { status: 400, message: "Ban khong the tu bao cao chinh minh" };
    }

    const targetUser = await User.findById(targetUserId).lean();
    if (!targetUser) {
      return { status: 404, message: "Khong tim thay nguoi dung bi bao cao" };
    }
  }

  if (targetType === "message") {
    if (!targetMessageId) return { status: 400, message: "Thieu tin nhan bi bao cao" };
    const message = await Message.findById(targetMessageId).lean();
    if (!message) return { status: 404, message: "Khong tim thay tin nhan bi bao cao" };
  }

  if (targetType === "conversation") {
    if (!targetConversationId) {
      return { status: 400, message: "Thieu cuoc tro chuyen bi bao cao" };
    }
    const conversation = await Conversation.findById(targetConversationId).lean();
    if (!conversation) {
      return { status: 404, message: "Khong tim thay cuoc tro chuyen bi bao cao" };
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
