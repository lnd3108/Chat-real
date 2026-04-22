import {
  ADMIN_SOCKET_EVENTS,
  USER_SOCKET_EVENTS,
} from "../../domain/constants/socket-events.js";
import { emitToAdmins } from "./admin-room.js";
import { emitToUser } from "./socket-gateway.js";

export const emitReportCreatedRealtime = ({ report }) => {
  emitToAdmins(ADMIN_SOCKET_EVENTS.REPORT_NEW, {
    report,
    createdAt: new Date().toISOString(),
  });
};

export const emitReportUpdatedRealtime = ({ report, metadata = {} }) => {
  emitToAdmins(ADMIN_SOCKET_EVENTS.REPORT_UPDATED, {
    report,
    metadata,
    updatedAt: new Date().toISOString(),
  });

  if (report?.reporterId?._id) {
    emitToUser(report.reporterId._id, USER_SOCKET_EVENTS.REPORT_STATUS_UPDATED, {
      reportId: report._id,
      status: report.status,
      reviewedAt: report.reviewedAt,
      resolutionNote: report.resolutionNote ?? null,
    });
  }
};
