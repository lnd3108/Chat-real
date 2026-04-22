import Report from "../../../models/Report.js";
import { emitNewReportCreated } from "../../../services/reportRealtimeService.js";
import {
  buildReporterSnapshot,
  validateReportInput,
  validateReportTarget,
} from "../domain/report-policy.js";
import {
  buildTargetConversationSnapshot,
  buildTargetMessagePreview,
  buildTargetUserSnapshot,
} from "../infrastructure/report-snapshot.repository.js";

export const createReportCommand = async ({ user, body }) => {
  const {
    targetType,
    targetUserId,
    targetMessageId,
    targetConversationId,
    reason,
    description,
  } = body;
  const reporterId = user._id;

  const inputError = validateReportInput({ targetType, reason, description });
  if (inputError) {
    const error = new Error(inputError);
    error.status = 400;
    throw error;
  }

  const targetError = await validateReportTarget({
    reporterId,
    targetType,
    targetUserId,
    targetMessageId,
    targetConversationId,
  });
  if (targetError) {
    const error = new Error(targetError.message);
    error.status = targetError.status;
    throw error;
  }

  const reporterSnapshot = buildReporterSnapshot(user);
  const [targetUserSnapshot, targetMessagePreview, targetConversationSnapshot] =
    await Promise.all([
      buildTargetUserSnapshot(targetType, targetUserId),
      buildTargetMessagePreview(targetType, targetMessageId),
      buildTargetConversationSnapshot(targetType, targetConversationId),
    ]);

  const report = new Report({
    reporterId,
    targetType,
    targetUserId: targetType === "user" ? targetUserId : null,
    targetMessageId: targetType === "message" ? targetMessageId : null,
    targetConversationId: targetType === "conversation" ? targetConversationId : null,
    reason: reason.trim(),
    description: description ? description.trim() : null,
    reporterSnapshot,
    targetUserSnapshot,
    targetMessagePreview,
    targetConversationSnapshot,
  });

  await report.save();
  await emitNewReportCreated(report._id);

  return report;
};

export const getMyReportsQuery = async ({ reporterId, page = 1, limit = 20, status, targetType }) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const query = { reporterId };
  if (status && ["pending", "reviewing", "resolved", "rejected"].includes(status)) {
    query.status = status;
  }
  if (targetType && ["user", "message", "conversation"].includes(targetType)) {
    query.targetType = targetType;
  }

  const reports = await Report.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
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
