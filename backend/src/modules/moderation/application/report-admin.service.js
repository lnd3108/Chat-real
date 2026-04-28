import Message from "../../../models/Message.js";
import Report from "../../../models/Report.js";
import User from "../../../models/User.js";
import { emitReportUpdated } from "../../../services/reportRealtimeService.js";
import {
  buildAdminReportQuery,
  buildModerationTargetUser,
  getAdminReportSort,
  validateAdminReportStatusUpdate,
} from "../../../services/adminReportService.js";

export const getReportsQuery = async ({
  page = 1,
  limit = 20,
  status,
  targetType,
  q,
  sort = "createdAt-desc",
}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;
  const query = buildAdminReportQuery({ status, targetType, q });
  const sortObj = getAdminReportSort(sort);

  const reports = await Report.find(query)
    .sort(sortObj)
    .skip(skip)
    .limit(limitNum)
    .populate("reporterId", "displayName userName avatarUrl")
    .populate("targetUserId", "displayName userName avatarUrl")
    .populate("reviewedByAdminId", "displayName userName")
    .lean();

  const total = await Report.countDocuments(query);

  return {
    reports,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  };
};

export const getReportDetailQuery = async ({ reportId }) => {
  const report = await Report.findById(reportId)
    .populate("reporterId", "displayName userName email avatarUrl")
    .populate("targetUserId", "displayName userName email avatarUrl status")
    .populate({
      path: "targetMessageId",
      select: "content imgUrl senderId senderDisplayName createdAt",
      populate: {
        path: "senderId",
        select: "displayName userName email avatarUrl status",
      },
    })
    .populate("targetConversationId", "type groupName members createdAt")
    .populate("reviewedByAdminId", "displayName userName email")
    .lean();

  if (!report) {
    const error = new Error("Không tìm thấy báo cáo");
    error.status = 404;
    throw error;
  }

  let moderationTargetUser = null;

  if (report.targetUserId) {
    moderationTargetUser = {
      _id: report.targetUserId._id,
      displayName:
        report.targetUserId.displayName ??
        report.targetUserSnapshot?.displayName ??
        "Người dùng đã xóa",
      userName:
        report.targetUserId.userName ??
        report.targetUserSnapshot?.userName ??
        "deleted-user",
      email:
        report.targetUserId.email ?? report.targetUserSnapshot?.email ?? null,
      avatarUrl:
        report.targetUserId.avatarUrl ??
        report.targetUserSnapshot?.avatarUrl ??
        null,
      status: report.targetUserId.status ?? "active",
      source: "target_user",
    };
  } else if (report.targetType === "message") {
    const sender = report.targetMessageId?.senderId;

    if (sender) {
      moderationTargetUser = {
        _id: sender._id,
        displayName:
          sender.displayName ??
          report.targetMessagePreview?.senderDisplayName ??
          "Người gửi",
        userName: sender.userName ?? "unknown",
        email: sender.email ?? null,
        avatarUrl: sender.avatarUrl ?? null,
        status: sender.status ?? "active",
        source: "message_sender",
      };
    } else if (report.targetMessagePreview?.senderDisplayName) {
      moderationTargetUser = {
        _id: null,
        displayName: report.targetMessagePreview.senderDisplayName,
        userName: "deleted-user",
        email: null,
        avatarUrl: null,
        status: "deleted",
        source: "message_sender_deleted",
      };
    }
  }

  return {
    report,
    moderationTargetUser:
      buildModerationTargetUser(report) ?? moderationTargetUser,
  };
};

export const updateReportStatusCommand = async ({
  reportId,
  status,
  resolutionNote,
  adminId,
}) => {
  const validationError = validateAdminReportStatusUpdate({
    status,
    resolutionNote,
  });
  if (validationError) {
    const error = new Error(validationError);
    error.status = 400;
    throw error;
  }

  const updateData = {
    status,
    reviewedByAdminId: adminId,
    reviewedAt: new Date(),
  };

  if (resolutionNote) {
    updateData.resolutionNote = resolutionNote.trim();
  }

  const report = await Report.findByIdAndUpdate(reportId, updateData, {
    new: true,
  })
    .populate("reporterId", "displayName userName avatarUrl")
    .populate("targetUserId", "displayName userName avatarUrl")
    .populate("reviewedByAdminId", "displayName userName")
    .lean();

  if (!report) {
    const error = new Error("Không tìm thấy báo cáo");
    error.status = 404;
    throw error;
  }

  await emitReportUpdated(report._id, {
    action: "status-updated",
    actorId: adminId.toString(),
  });

  return report;
};

export const resolveReportWithActionCommand = async ({
  reportId,
  action,
  resolutionNote,
  adminId,
}) => {
  const report = await Report.findById(reportId);
  if (!report) {
    const error = new Error("Không tìm thấy báo cáo");
    error.status = 404;
    throw error;
  }

  let actionResult = null;

  if (action === "ban-user" && report.targetUserId) {
    await User.findByIdAndUpdate(report.targetUserId, { status: "banned" });
    actionResult = "Đã khóa người dùng";
  } else if (action === "unban-user" && report.targetUserId) {
    await User.findByIdAndUpdate(report.targetUserId, { status: "active" });
    actionResult = "Đã mở khóa người dùng";
  } else if (action === "delete-account" && report.targetUserId) {
    await User.findByIdAndUpdate(report.targetUserId, { status: "inactive" });
    actionResult = "Đã đánh dấu tài khoản để xóa";
  } else if (action === "delete-message" && report.targetMessageId) {
    await Message.findByIdAndUpdate(report.targetMessageId, {
      isDeletedForEveryone: true,
    });
    actionResult = "Đã xóa tin nhắn";
  }

  const updateData = {
    status: "resolved",
    reviewedByAdminId: adminId,
    reviewedAt: new Date(),
    resolutionNote: resolutionNote
      ? `[${action}] ${resolutionNote.trim()}`
      : `[${action}] Đã xử lý theo hành động`,
  };

  const updatedReport = await Report.findByIdAndUpdate(reportId, updateData, {
    new: true,
  })
    .populate("reporterId", "displayName userName avatarUrl")
    .populate("targetUserId", "displayName userName avatarUrl")
    .populate("reviewedByAdminId", "displayName userName")
    .lean();

  await emitReportUpdated(updatedReport._id, {
    action,
    actorId: adminId.toString(),
  });

  return {
    report: updatedReport,
    action: actionResult,
  };
};
