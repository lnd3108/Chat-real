import Conversation from "../../../models/Conversation.js";
import Message from "../../../models/Message.js";
import User from "../../../models/User.js";

export const REPORT_TARGET_TYPES = ["user", "message", "conversation"];

export const validateReportInput = ({ targetType, reason, description }) => {
  if (!targetType || !REPORT_TARGET_TYPES.includes(targetType)) {
    return "Loại đối tượng báo cáo không hợp lệ";
  }

  if (!reason || reason.trim().length === 0) {
    return "Vui lòng nhập lý do báo cáo";
  }

  if (reason.trim().length > 500) {
    return "Lý do báo cáo không dược vượt quá 500 ký tự";
  }

  if (description && description.length > 2000) {
    return "Mô tả chi tiết không được vượt quá 2000 ký tự";
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
    if (!targetUserId)
      return { status: 400, message: "Thiếu người dùng bị báo cáo" };
    if (reporterId.toString() === targetUserId.toString()) {
      return { status: 400, message: "Bạn không thể tự báo cáo chính mình" };
    }

    const targetUser = await User.findById(targetUserId).lean();
    if (!targetUser) {
      return { status: 404, message: "Không tìm thấy người dùng bị báo cáo" };
    }
  }

  if (targetType === "message") {
    if (!targetMessageId)
      return { status: 400, message: "Thiếu tin nhắn bị báo cáo" };
    const message = await Message.findById(targetMessageId).lean();
    if (!message)
      return { status: 404, message: "Không tìm thấy tin nhắn bị báo cáo" };
  }

  if (targetType === "conversation") {
    if (!targetConversationId) {
      return { status: 400, message: "Thiếu cuộc trò chuyện bị báo cáo" };
    }
    const conversation =
      await Conversation.findById(targetConversationId).lean();
    if (!conversation) {
      return {
        status: 404,
        message: "Không tìm thấy cuộc trò chuyện bị báo cáo",
      };
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
