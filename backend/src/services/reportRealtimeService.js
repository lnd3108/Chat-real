import Report from "../models/Report.js";
import { ADMIN_SOCKET_EVENTS, USER_SOCKET_EVENTS } from "../constants/socketEvents.js";
import { emitToAdmins } from "../socket/adminSocket.js";
import { emitToUser } from "../socket/index.js";
import { buildAdminActor, emitAdminNotification } from "./adminNotificationService.js";
import { emitDashboardStatsUpdated } from "./dashboardRealtimeService.js";

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

  emitToAdmins(ADMIN_SOCKET_EVENTS.REPORT_NEW, {
    report,
    createdAt: new Date().toISOString(),
  });

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

  emitToAdmins(ADMIN_SOCKET_EVENTS.REPORT_UPDATED, {
    report,
    metadata,
    updatedAt: new Date().toISOString(),
  });

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

  if (report.reporterId?._id) {
    emitToUser(report.reporterId._id, USER_SOCKET_EVENTS.REPORT_STATUS_UPDATED, {
      reportId: report._id,
      status: report.status,
      reviewedAt: report.reviewedAt,
      resolutionNote: report.resolutionNote ?? null,
    });
  }

  await emitDashboardStatsUpdated({ reason: "report:updated", reportId: report._id.toString() });
  return report;
};
