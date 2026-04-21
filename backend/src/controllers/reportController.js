import Report from "../models/Report.js";
import { emitNewReportCreated } from "../services/reportRealtimeService.js";
import {
  buildReporterSnapshot,
  buildTargetConversationSnapshot,
  buildTargetMessagePreview,
  buildTargetUserSnapshot,
  validateReportInput,
  validateReportTarget,
} from "../services/reportService.js";
import { sendError, sendServerError } from "../utils/controllerResponses.js";

/**
 * Tạo báo cáo mới
 * POST /reports
 */
export const createReport = async (req, res) => {
  try {
    const { targetType, targetUserId, targetMessageId, targetConversationId, reason, description } =
      req.body;
    const reporterId = req.user._id;

    const inputError = validateReportInput({ targetType, reason, description });
    if (inputError) {
      return sendError(res, 400, inputError);
    }

    const targetError = await validateReportTarget({
      reporterId,
      targetType,
      targetUserId,
      targetMessageId,
      targetConversationId,
    });
    if (targetError) {
      return sendError(res, targetError.status, targetError.message);
    }

    const reporterSnapshot = buildReporterSnapshot(req.user);
    const [targetUserSnapshot, targetMessagePreview, targetConversationSnapshot] =
      await Promise.all([
        buildTargetUserSnapshot(targetType, targetUserId),
        buildTargetMessagePreview(targetType, targetMessageId),
        buildTargetConversationSnapshot(targetType, targetConversationId),
      ]);

    // Tạo báo cáo
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

    res.status(201).json({
      message: "Tạo báo cáo thành công",
      data: { report },
    });
  } catch (error) {
    return sendServerError(res, error, {
      logMessage: "Lỗi khi tạo báo cáo:",
      message: "Không thể tạo báo cáo",
    });
  }
};

/**
 * Lấy danh sách báo cáo của người dùng hiện tại
 * GET /reports/me
 */
export const getMyReports = async (req, res) => {
  try {
    const reporterId = req.user._id;
    const { page = 1, limit = 20, status, targetType } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
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

    res.json({
      message: "Lấy danh sách báo cáo thành công",
      data: {
        reports,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    return sendServerError(res, error, {
      logMessage: "Lỗi khi lấy danh sách báo cáo của người dùng:",
      message: "Không thể lấy danh sách báo cáo",
    });
  }
};
