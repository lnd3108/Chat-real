import {
  getDashboardOverviewSummary,
  getDashboardStatsSummary,
} from "../../application/dashboard.service.js";
import {
  deleteUserAsAdminCommand,
  getUserDetailQuery,
  getUsersQuery,
  updateUserStatusCommand,
} from "../../application/user-management.service.js";
import {
  getReportDetailQuery,
  getReportsQuery,
  resolveReportWithActionCommand,
  updateReportStatusCommand,
} from "../../../moderation/application/report-admin.service.js";
import {
  confirmMaintenanceToggleCommand,
  getMaintenanceInfoQuery,
  getSystemHealthSummary,
  requestMaintenancePasswordVerificationCommand,
  updateMaintenanceMessageCommand,
  verifyMaintenancePasswordCommand,
} from "../../../system/application/admin-maintenance.service.js";
import {
  getAdminBlockedUsersQuery,
  getAdminMessagesQuery,
  getBlockDetailAdminQuery,
  getBlocksAdminQuery,
  getConversationDetailAdminQuery,
  getConversationsAdminQuery,
  getDashboardMessageChartData,
  getDashboardReportChartData,
  getDashboardSupportChartData,
  getDashboardUserChartData,
  getFriendRequestsAdminQuery,
  getFriendshipsAdminQuery,
  unblockBlockRelationAsAdminCommand,
  updateUserRoleLegacyCommand,
} from "../../application/admin-read.service.js";
import { makeCommandHandler, makeQueryHandler } from "../../../../shared/api/http/controller-factory.js";
import {
  makeJsonErrorHandler,
  makePayloadErrorHandler,
  makeServerErrorHandler,
  makeStatusMessageErrorHandler,
  makeSuccessFlagErrorHandler,
} from "../../../../shared/api/http/error-handlers.js";
import {
  presentJson,
  presentMessageData,
  presentSuccessData,
  presentSuccessMessage,
} from "../../../../shared/api/http/presenters.js";

export const getDashboardStats = makeQueryHandler({
  execute: async () => ({
    success: true,
    data: await getDashboardStatsSummary(),
  }),
  present: (body) => presentJson({ body }),
  onError: makeSuccessFlagErrorHandler({
    logMessage: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi lÃƒÂ¡Ã‚ÂºÃ‚Â¥y thÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœng kÃƒÆ’Ã‚Âª dashboard:",
    fallbackMessage: "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ lÃƒÂ¡Ã‚ÂºÃ‚Â¥y thÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœng kÃƒÆ’Ã‚Âª dashboard",
  }),
});

export const getDashboardOverview = makeQueryHandler({
  execute: async () => ({
    success: true,
    data: await getDashboardOverviewSummary(),
  }),
  present: (body) => presentJson({ body }),
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Loi khi lay dashboard overview:",
    fallbackMessage: "Khong the lay du lieu dashboard overview",
  }),
});

export const getDashboardUserChart = makeQueryHandler({
  execute: async (req) => ({
    success: true,
    data: await getDashboardUserChartData({ days: req.query.days }),
  }),
  present: (body) => presentJson({ body }),
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Loi khi lay chart user dashboard:",
    fallbackMessage: "Khong the lay du lieu chart nguoi dung",
  }),
});

export const getDashboardMessageChart = makeQueryHandler({
  execute: async (req) => ({
    success: true,
    data: await getDashboardMessageChartData({ days: req.query.days }),
  }),
  present: (body) => presentJson({ body }),
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Loi khi lay chart message dashboard:",
    fallbackMessage: "Khong the lay du lieu chart tin nhan",
  }),
});

export const getDashboardReportChart = makeQueryHandler({
  execute: async () => ({
    success: true,
    data: await getDashboardReportChartData(),
  }),
  present: (body) => presentJson({ body }),
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Loi khi lay chart report dashboard:",
    fallbackMessage: "Khong the lay du lieu chart bao cao",
  }),
});

export const getDashboardSupportChart = makeQueryHandler({
  execute: async () => ({
    success: true,
    data: await getDashboardSupportChartData(),
  }),
  present: (body) => presentJson({ body }),
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Loi khi lay chart support dashboard:",
    fallbackMessage: "Khong the lay du lieu chart ho tro",
  }),
});

export const getUsers = makeQueryHandler({
  execute: (req) => getUsersQuery({ actor: req.user, query: req.query }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi lÃƒÂ¡Ã‚ÂºÃ‚Â¥y danh sÃƒÆ’Ã‚Â¡ch ngÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Âi dÃƒÆ’Ã‚Â¹ng:",
    fallbackMessage: "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ lÃƒÂ¡Ã‚ÂºÃ‚Â¥y danh sÃƒÆ’Ã‚Â¡ch ngÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Âi dÃƒÆ’Ã‚Â¹ng",
  }),
});

export const getUserDetail = makeQueryHandler({
  execute: (req) =>
    getUserDetailQuery({
      actor: req.user,
      userId: req.params.id,
    }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage:
      "LÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Âi khi lÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¥y thÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng tin ngÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âi dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¹ng:",
    fallbackMessage: "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ lÃƒÂ¡Ã‚ÂºÃ‚Â¥y thÃƒÆ’Ã‚Â´ng tin ngÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Âi dÃƒÆ’Ã‚Â¹ng",
  }),
});

export const updateUserStatus = makeCommandHandler({
  execute: (req) =>
    updateUserStatusCommand({
      actor: req.user,
      userId: req.params.id,
      status: req.body?.status,
    }),
  present: (result) =>
    presentSuccessMessage(result.message, { user: result.user }),
  onError: makeSuccessFlagErrorHandler({
    logMessage:
      "LÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Âi khi cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­p nhÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­t trÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡ng thÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡i ngÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âi dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¹ng:",
    fallbackMessage:
      "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ cÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t trÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i ngÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Âi dÃƒÆ’Ã‚Â¹ng.",
  }),
});

export const deleteUserAsAdmin = makeCommandHandler({
  execute: (req) =>
    deleteUserAsAdminCommand({
      actor: req.user,
      targetUserId: req.params.id,
      reason:
        typeof req.body?.reason === "string" && req.body.reason.trim()
          ? req.body.reason.trim()
          : null,
    }),
  present: (result) => presentSuccessMessage(result.message, result.summary),
  onError: makeSuccessFlagErrorHandler({
    fallbackMessage: "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ xÃƒÆ’Ã‚Â³a tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n.",
  }),
});

export const updateUserRole = makeCommandHandler({
  execute: (req) =>
    updateUserRoleLegacyCommand({
      userId: req.params.userId,
      role: req.body?.role,
    }),
  present: (data) => presentSuccessMessage("CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t role thÃƒÂ nh cÃƒÂ´ng", data),
  onError: makeSuccessFlagErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t role:",
    fallbackMessage: "KhÃƒÂ´ng thÃ¡Â»Æ’ cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t role",
  }),
});

export const getFriendRequestsAdmin = makeQueryHandler({
  execute: (req) => getFriendRequestsAdminQuery({ query: req.query }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch lÃ¡Â»Âi mÃ¡Â»Âi kÃ¡ÂºÂ¿t bÃ¡ÂºÂ¡n:",
    fallbackMessage: "KhÃƒÂ´ng thÃ¡Â»Æ’ lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch lÃ¡Â»Âi mÃ¡Â»Âi kÃ¡ÂºÂ¿t bÃ¡ÂºÂ¡n",
  }),
});

export const getFriendships = makeQueryHandler({
  execute: (req) => getFriendshipsAdminQuery({ query: req.query }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Loi khi lay danh sach friendship da accepted:",
    fallbackMessage: "Khong the lay danh sach friendship da accepted",
  }),
});

export const getConversations = makeQueryHandler({
  execute: (req) => getConversationsAdminQuery({ query: req.query }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch cuÃ¡Â»â„¢c trÃƒÂ² chuyÃ¡Â»â€¡n:",
    fallbackMessage: "KhÃƒÂ´ng thÃ¡Â»Æ’ lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch cuÃ¡Â»â„¢c trÃƒÂ² chuyÃ¡Â»â€¡n",
  }),
});

export const getMessages = makeQueryHandler({
  execute: (req) => getAdminMessagesQuery({ query: req.query }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch tin nhÃ¡ÂºÂ¯n:",
    fallbackMessage: "KhÃƒÂ´ng thÃ¡Â»Æ’ lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch tin nhÃ¡ÂºÂ¯n",
  }),
});

export const getBlockedUsers = makeQueryHandler({
  execute: (req) => getAdminBlockedUsersQuery({ query: req.query }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch khÃ¡Â»â€˜i ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng:",
    fallbackMessage: "KhÃƒÂ´ng thÃ¡Â»Æ’ lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch khÃ¡Â»â€˜i ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng",
  }),
});

export const getConversationDetail = makeQueryHandler({
  execute: (req) =>
    getConversationDetailAdminQuery({
      conversationId: req.params.id,
    }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi lÃ¡ÂºÂ¥y chi tiÃ¡ÂºÂ¿t cuÃ¡Â»â„¢c trÃƒÂ² chuyÃ¡Â»â€¡n:",
    fallbackMessage: "KhÃƒÂ´ng thÃ¡Â»Æ’ lÃ¡ÂºÂ¥y chi tiÃ¡ÂºÂ¿t cuÃ¡Â»â„¢c trÃƒÂ² chuyÃ¡Â»â€¡n",
  }),
});

export const getBlocks = makeQueryHandler({
  execute: (req) => getBlocksAdminQuery({ query: req.query }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Loi khi lay danh sach quan he chan:",
    fallbackMessage: "Khong the lay danh sach quan he chan",
  }),
});

export const getBlockDetail = makeQueryHandler({
  execute: (req) => getBlockDetailAdminQuery({ blockId: req.params.id }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Loi khi lay chi tiet quan he chan:",
    fallbackMessage: "Khong the lay chi tiet quan he chan.",
  }),
});

export const unblockBlockRelationAsAdmin = makeCommandHandler({
  execute: (req) =>
    unblockBlockRelationAsAdminCommand({
      blockId: req.params.id,
    }),
  present: (result) =>
    presentSuccessMessage("Admin da go block relation thanh cong.", {
      block: result.block,
    }),
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Loi khi admin go block relation:",
    fallbackMessage: "Khong the go block relation.",
  }),
});

export const getReports = makeQueryHandler({
  execute: (req) => getReportsQuery(req.query),
  present: (data) =>
    presentMessageData("LÃ¡ÂºÂ¥y danh sÃƒÂ¡ch bÃƒÂ¡o cÃƒÂ¡o thÃƒÂ nh cÃƒÂ´ng", data),
  onError: makeStatusMessageErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch bÃƒÂ¡o cÃƒÂ¡o:",
    fallbackMessage: "KhÃƒÂ´ng thÃ¡Â»Æ’ lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch bÃƒÂ¡o cÃƒÂ¡o",
  }),
});

export const getReportDetail = makeQueryHandler({
  execute: (req) => getReportDetailQuery({ reportId: req.params.id }),
  present: (data) =>
    presentMessageData("LÃ¡ÂºÂ¥y chi tiÃ¡ÂºÂ¿t bÃƒÂ¡o cÃƒÂ¡o thÃƒÂ nh cÃƒÂ´ng", data),
  onError: makeStatusMessageErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi lÃ¡ÂºÂ¥y chi tiÃ¡ÂºÂ¿t bÃƒÂ¡o cÃƒÂ¡o:",
    fallbackMessage: "KhÃƒÂ´ng thÃ¡Â»Æ’ lÃ¡ÂºÂ¥y chi tiÃ¡ÂºÂ¿t bÃƒÂ¡o cÃƒÂ¡o",
  }),
});

export const updateReportStatus = makeCommandHandler({
  execute: async (req) => ({
    report: await updateReportStatusCommand({
      reportId: req.params.id,
      status: req.body.status,
      resolutionNote: req.body.resolutionNote,
      adminId: req.user._id,
    }),
  }),
  present: (data) =>
    presentMessageData("CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t trÃ¡ÂºÂ¡ng thÃƒÂ¡i bÃƒÂ¡o cÃƒÂ¡o thÃƒÂ nh cÃƒÂ´ng", data),
  onError: makeStatusMessageErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t trÃ¡ÂºÂ¡ng thÃƒÂ¡i bÃƒÂ¡o cÃƒÂ¡o:",
    fallbackMessage: "KhÃƒÂ´ng thÃ¡Â»Æ’ cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t trÃ¡ÂºÂ¡ng thÃƒÂ¡i bÃƒÂ¡o cÃƒÂ¡o",
  }),
});

export const resolveReportWithAction = makeCommandHandler({
  execute: (req) =>
    resolveReportWithActionCommand({
      reportId: req.params.id,
      action: req.body.action,
      resolutionNote: req.body.resolutionNote,
      adminId: req.user._id,
    }),
  present: (data) =>
    presentMessageData("XÃ¡Â»Â­ lÃƒÂ½ bÃƒÂ¡o cÃƒÂ¡o bÃ¡ÂºÂ±ng hÃƒÂ nh Ã„â€˜Ã¡Â»â„¢ng thÃƒÂ nh cÃƒÂ´ng", data),
  onError: makeStatusMessageErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi xÃ¡Â»Â­ lÃƒÂ½ bÃƒÂ¡o cÃƒÂ¡o bÃ¡ÂºÂ±ng hÃƒÂ nh Ã„â€˜Ã¡Â»â„¢ng:",
    fallbackMessage: "KhÃƒÂ´ng thÃ¡Â»Æ’ xÃ¡Â»Â­ lÃƒÂ½ bÃƒÂ¡o cÃƒÂ¡o bÃ¡ÂºÂ±ng hÃƒÂ nh Ã„â€˜Ã¡Â»â„¢ng",
  }),
});

export const getSystemHealth = makeQueryHandler({
  execute: () => getSystemHealthSummary(),
  present: (body) => presentJson({ body }),
  onError: makeJsonErrorHandler({
    status: 500,
    buildBody: (error) => ({
      status: "unhealthy",
      message: error.message,
    }),
  }),
});

export const getMaintenanceInfo = makeQueryHandler({
  execute: () => getMaintenanceInfoQuery(),
  present: (body) => presentJson({ body }),
  onError: makeServerErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi lÃ¡ÂºÂ¥y thÃƒÂ´ng tin bÃ¡ÂºÂ£o trÃƒÂ¬:",
    message: "LÃ¡Â»â€”i hÃ¡Â»â€¡ thÃ¡Â»â€˜ng",
  }),
});

export const requestMaintenancePasswordVerification = makeCommandHandler({
  execute: (req) =>
    requestMaintenancePasswordVerificationCommand({
      adminId: req.user._id,
    }),
  present: (body) => presentJson({ body }),
  onError: makeServerErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi yÃƒÂªu cÃ¡ÂºÂ§u xÃƒÂ¡c minh mÃ¡ÂºÂ­t khÃ¡ÂºÂ©u:",
    message: "LÃ¡Â»â€”i hÃ¡Â»â€¡ thÃ¡Â»â€˜ng",
  }),
});

export const verifyMaintenancePassword = makeCommandHandler({
  execute: (req) =>
    verifyMaintenancePasswordCommand({
      adminId: req.user._id,
      password: req.body.password,
    }),
  present: (body) => presentJson({ body }),
  onError: makeServerErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi xÃƒÂ¡c minh mÃ¡ÂºÂ­t khÃ¡ÂºÂ©u bÃ¡ÂºÂ£o trÃƒÂ¬:",
    message: "LÃ¡Â»â€”i hÃ¡Â»â€¡ thÃ¡Â»â€˜ng",
  }),
});

export const confirmMaintenanceToggle = makeCommandHandler({
  execute: (req) =>
    confirmMaintenanceToggleCommand({
      adminId: req.user._id,
      code: req.body.code,
      enable: req.body.enable,
    }),
  present: (body) => presentJson({ body }),
  onError: makePayloadErrorHandler({
    fallbackMessage: "LÃ¡Â»â€”i hÃ¡Â»â€¡ thÃ¡Â»â€˜ng",
  }),
});

export const updateMaintenanceMessage = makeCommandHandler({
  execute: (req) =>
    updateMaintenanceMessageCommand({
      message: req.body.message,
    }),
  present: (body) => presentJson({ body }),
  onError: makeServerErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t thÃƒÂ´ng bÃƒÂ¡o bÃ¡ÂºÂ£o trÃƒÂ¬:",
    message: "LÃ¡Â»â€”i hÃ¡Â»â€¡ thÃ¡Â»â€˜ng",
  }),
});
