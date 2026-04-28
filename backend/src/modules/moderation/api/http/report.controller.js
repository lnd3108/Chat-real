import {
  createReportCommand,
  getMyReportsQuery,
} from "../../application/report-user.service.js";
import {
  makeCommandHandler,
  makeQueryHandler,
} from "../../../../shared/api/http/controller-factory.js";
import { makeStatusMessageErrorHandler } from "../../../../shared/api/http/error-handlers.js";
import { presentMessageData } from "../../../../shared/api/http/presenters.js";

export const createReport = makeCommandHandler({
  execute: (req) => createReportCommand({ user: req.user, body: req.body }),
  present: (report) =>
    presentMessageData("Tạo báo cáo thành công", { report }, 201),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi khi tạo báo cáo:",
    fallbackMessage: "Không thể tạo báo cáo",
  }),
});

export const getMyReports = makeQueryHandler({
  execute: (req) =>
    getMyReportsQuery({
      reporterId: req.user._id,
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      targetType: req.query.targetType,
    }),
  present: (data) =>
    presentMessageData("Lấy danh sách báo cáo thành công", data),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi khi lấy danh sách báo cáo:",
    fallbackMessage: "Không thể lấy danh sách báo cáo",
  }),
});
