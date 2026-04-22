import Report from "../models/Report.js";
import { buildAdminActor, emitAdminNotification } from "./adminNotificationService.js";
import { emitDashboardStatsUpdated } from "./dashboardRealtimeService.js";
import {
  emitReportCreatedRealtime,
  emitReportUpdatedRealtime,
} from "../shared/infrastructure/realtime/report-realtime.js";

const mapReportPayload = async (reportId) => {
  return Report.findById(reportId)
    .populate("reporterId", "displayName userName avatarUrl")
    .populate("targetUserId", "displayName userName avatarUrl")
    .populate("reviewedByAdminId", "displayName userName avatarUrl email role")
    .lean();
};

export const emitNewReportCreated = async (reportId) => {
  const report = await mapReportPayload(reportId);
  if (!report) {
    return null;
  }

  emitReportCreatedRealtime({ report });

  emitAdminNotification({
    type: "report",
    title: "Co bao cao moi",
    message: `Bao cao moi tu @${report.reporterSnapshot?.userName ?? "unknown"}`,
    link: `/admin/reports/${report._id}`,
    entityId: report._id.toString(),
    actor: buildAdminActor(report.reporterSnapshot),
    metadata: {
      status: report.status,
      targetType: report.targetType,
    },
    severity: "warning",
  });

  await emitDashboardStatsUpdated({ reason: "report:new", reportId: report._id.toString() });
  return report;
};

export const emitReportUpdated = async (reportId, metadata = {}) => {
  const report = await mapReportPayload(reportId);
  if (!report) {
    return null;
  }

  emitReportUpdatedRealtime({ report, metadata });

  emitAdminNotification({
    type: "report",
    title: "Bao cao da duoc cap nhat",
    message: `Bao cao ${report._id.toString().slice(-6)} da chuyen sang ${report.status}`,
    link: `/admin/reports/${report._id}`,
    entityId: report._id.toString(),
    actor: buildAdminActor(report.reviewedByAdminId),
    metadata: {
      status: report.status,
      ...metadata,
    },
  });

  await emitDashboardStatsUpdated({ reason: "report:updated", reportId: report._id.toString() });
  return report;
};
