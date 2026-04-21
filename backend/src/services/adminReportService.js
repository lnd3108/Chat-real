import { escapeRegex } from "../utils/regex.js";

const REPORT_STATUSES = ["pending", "reviewing", "resolved", "rejected"];
const REPORT_TARGET_TYPES = ["user", "message", "conversation"];

export const buildAdminReportQuery = ({ status, targetType, q }) => {
  const query = {};

  if (status && REPORT_STATUSES.includes(status)) {
    query.status = status;
  }

  if (targetType && REPORT_TARGET_TYPES.includes(targetType)) {
    query.targetType = targetType;
  }

  if (q && q.trim().length > 0) {
    const searchRegex = new RegExp(escapeRegex(q.trim()), "i");
    query.$or = [
      { reason: searchRegex },
      { description: searchRegex },
      { "reporterSnapshot.displayName": searchRegex },
      { "reporterSnapshot.userName": searchRegex },
      { "targetUserSnapshot.displayName": searchRegex },
      { "targetUserSnapshot.userName": searchRegex },
    ];
  }

  return query;
};

export const getAdminReportSort = (sort = "createdAt-desc") => {
  if (sort === "createdAt-asc") {
    return { createdAt: 1 };
  }

  if (sort === "status") {
    return { status: 1, createdAt: -1 };
  }

  if (sort === "updated") {
    return { updatedAt: -1 };
  }

  return { createdAt: -1 };
};

export const buildModerationTargetUser = (report) => {
  if (report.targetUserId) {
    return {
      _id: report.targetUserId._id,
      displayName:
        report.targetUserId.displayName ??
        report.targetUserSnapshot?.displayName ??
        "Người dùng đã xóa",
      userName: report.targetUserId.userName ?? report.targetUserSnapshot?.userName ?? "deleted-user",
      email: report.targetUserId.email ?? report.targetUserSnapshot?.email ?? null,
      avatarUrl: report.targetUserId.avatarUrl ?? report.targetUserSnapshot?.avatarUrl ?? null,
      status: report.targetUserId.status ?? "active",
      source: "target_user",
    };
  }

  if (report.targetType !== "message") {
    return null;
  }

  const sender = report.targetMessageId?.senderId;
  if (sender) {
    return {
      _id: sender._id,
      displayName: sender.displayName ?? report.targetMessagePreview?.senderDisplayName ?? "Người gửi",
      userName: sender.userName ?? "unknown",
      email: sender.email ?? null,
      avatarUrl: sender.avatarUrl ?? null,
      status: sender.status ?? "active",
      source: "message_sender",
    };
  }

  if (!report.targetMessagePreview?.senderDisplayName) {
    return null;
  }

  return {
    _id: null,
    displayName: report.targetMessagePreview.senderDisplayName,
    userName: "deleted-user",
    email: null,
    avatarUrl: null,
    status: "deleted",
    source: "message_sender_deleted",
  };
};

export const validateAdminReportStatusUpdate = ({ status, resolutionNote }) => {
  if (!status || !REPORT_STATUSES.includes(status)) {
    return "Trạng thái báo cáo không hợp lệ";
  }

  if (resolutionNote && resolutionNote.length > 2000) {
    return "Ghi chú xử lý không được vượt quá 2000 ký tự";
  }

  return null;
};
