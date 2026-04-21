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

/**
 * Create a new report
 * POST /reports
 */
export const createReport = async (req, res) => {
  try {
    const { targetType, targetUserId, targetMessageId, targetConversationId, reason, description } =
      req.body;
    const reporterId = req.user._id;

    const inputError = validateReportInput({ targetType, reason, description });
    if (inputError) {
      return res.status(400).json({ message: inputError });
    }

    const targetError = await validateReportTarget({
      reporterId,
      targetType,
      targetUserId,
      targetMessageId,
      targetConversationId,
    });
    if (targetError) {
      return res.status(targetError.status).json({ message: targetError.message });
    }

    const reporterSnapshot = buildReporterSnapshot(req.user);
    const [targetUserSnapshot, targetMessagePreview, targetConversationSnapshot] =
      await Promise.all([
        buildTargetUserSnapshot(targetType, targetUserId),
        buildTargetMessagePreview(targetType, targetMessageId),
        buildTargetConversationSnapshot(targetType, targetConversationId),
      ]);

    // Create report
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
      message: "Report created successfully",
      data: { report },
    });
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({ message: "Failed to create report" });
  }
};

/**
 * Get user's own reports
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
      message: "Reports retrieved successfully",
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
    console.error("Error fetching user reports:", error);
    res.status(500).json({ message: "Failed to fetch reports" });
  }
};
