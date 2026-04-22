import {
  createReportCommand,
  getMyReportsQuery,
} from "../../application/report-user.service.js";
import { makeCommandHandler, makeQueryHandler } from "../../../../shared/api/http/controller-factory.js";
import { makeStatusMessageErrorHandler } from "../../../../shared/api/http/error-handlers.js";
import { presentMessageData } from "../../../../shared/api/http/presenters.js";

export const createReport = makeCommandHandler({
  execute: (req) => createReportCommand({ user: req.user, body: req.body }),
  present: (report) =>
    presentMessageData(
      "TÃƒÂ¡Ã‚ÂºÃ‚Â¡o bÃƒÆ’Ã‚Â¡o cÃƒÆ’Ã‚Â¡o thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng",
      { report },
      201,
    ),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Loi khi tao bao cao:",
    fallbackMessage: "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ tÃƒÂ¡Ã‚ÂºÃ‚Â¡o bÃƒÆ’Ã‚Â¡o cÃƒÆ’Ã‚Â¡o",
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
    presentMessageData(
      "LÃƒÂ¡Ã‚ÂºÃ‚Â¥y danh sÃƒÆ’Ã‚Â¡ch bÃƒÆ’Ã‚Â¡o cÃƒÆ’Ã‚Â¡o thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng",
      data,
    ),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Loi khi lay danh sach bao cao:",
    fallbackMessage: "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ lÃƒÂ¡Ã‚ÂºÃ‚Â¥y danh sÃƒÆ’Ã‚Â¡ch bÃƒÆ’Ã‚Â¡o cÃƒÆ’Ã‚Â¡o",
  }),
});
