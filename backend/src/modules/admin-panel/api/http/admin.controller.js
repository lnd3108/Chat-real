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
import {
  handleController,
  sendServerError,
  sendSuccess,
} from "../../../../utils/controllerResponses.js";

const sendAdminFailure = (message, logMessage = null) => (error, _req, res) => {
  if (error?.status) {
    return sendSuccess(
      res,
      {
        success: false,
        message: error.message || message,
      },
      error.status,
    );
  }

  if (logMessage) {
    console.error(logMessage, error);
  }

  return sendSuccess(
    res,
    {
      success: false,
      message,
    },
    500,
  );
};

const jsonSuccess = (factory, status = 200) =>
  handleController(
    async (req, res) => sendSuccess(res, await factory(req), status),
    sendAdminFailure("Loi he thong"),
  );

export const getDashboardStats = handleController(
  async (_req, res) =>
    sendSuccess(res, {
      success: true,
      data: await getDashboardStatsSummary(),
    }),
  sendAdminFailure(
    "KhÃƒÂ´ng thÃ¡Â»Æ’ lÃ¡ÂºÂ¥y thÃ¡Â»â€˜ng kÃƒÂª dashboard",
    "LÃ¡Â»â€”i khi lÃ¡ÂºÂ¥y thÃ¡Â»â€˜ng kÃƒÂª dashboard:",
  ),
);

export const getDashboardOverview = handleController(
  async (_req, res) =>
    sendSuccess(res, {
      success: true,
      data: await getDashboardOverviewSummary(),
    }),
  sendAdminFailure(
    "Khong the lay du lieu dashboard overview",
    "Loi khi lay dashboard overview:",
  ),
);

export const getDashboardUserChart = handleController(
  async (req, res) =>
    sendSuccess(res, {
      success: true,
      data: await getDashboardUserChartData({ days: req.query.days }),
    }),
  sendAdminFailure(
    "Khong the lay du lieu chart nguoi dung",
    "Loi khi lay chart user dashboard:",
  ),
);

export const getDashboardMessageChart = handleController(
  async (req, res) =>
    sendSuccess(res, {
      success: true,
      data: await getDashboardMessageChartData({ days: req.query.days }),
    }),
  sendAdminFailure(
    "Khong the lay du lieu chart tin nhan",
    "Loi khi lay chart message dashboard:",
  ),
);

export const getDashboardReportChart = handleController(
  async (_req, res) =>
    sendSuccess(res, {
      success: true,
      data: await getDashboardReportChartData(),
    }),
  sendAdminFailure(
    "Khong the lay du lieu chart bao cao",
    "Loi khi lay chart report dashboard:",
  ),
);

export const getDashboardSupportChart = handleController(
  async (_req, res) =>
    sendSuccess(res, {
      success: true,
      data: await getDashboardSupportChartData(),
    }),
  sendAdminFailure(
    "Khong the lay du lieu chart ho tro",
    "Loi khi lay chart support dashboard:",
  ),
);

export const getUsers = handleController(
  async (req, res) =>
    sendSuccess(res, {
      success: true,
      data: await getUsersQuery({ actor: req.user, query: req.query }),
    }),
  sendAdminFailure(
    "KhÃƒÂ´ng thÃ¡Â»Æ’ lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng",
    "LÃ¡Â»â€”i khi lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng:",
  ),
);

export const getUserDetail = handleController(
  async (req, res) =>
    sendSuccess(res, {
      success: true,
      data: await getUserDetailQuery({
        actor: req.user,
        userId: req.params.id,
      }),
    }),
  sendAdminFailure(
    "KhÃƒÂ´ng thÃ¡Â»Æ’ lÃ¡ÂºÂ¥y thÃƒÂ´ng tin ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng",
    "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi lÃƒÂ¡Ã‚ÂºÃ‚Â¥y thÃƒÆ’Ã‚Â´ng tin ngÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Âi dÃƒÆ’Ã‚Â¹ng:",
  ),
);

export const updateUserStatus = handleController(
  async (req, res) => {
    const result = await updateUserStatusCommand({
      actor: req.user,
      userId: req.params.id,
      status: req.body?.status,
    });

    return sendSuccess(res, {
      success: true,
      message: result.message,
      data: { user: result.user },
    });
  },
  sendAdminFailure(
    "KhÃƒÂ´ng thÃ¡Â»Æ’ cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t trÃ¡ÂºÂ¡ng thÃƒÂ¡i ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng.",
    "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi cÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t trÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i ngÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Âi dÃƒÆ’Ã‚Â¹ng:",
  ),
);

export const deleteUserAsAdmin = handleController(
  async (req, res) => {
    const reason =
      typeof req.body?.reason === "string" && req.body.reason.trim()
        ? req.body.reason.trim()
        : null;

    const result = await deleteUserAsAdminCommand({
      actor: req.user,
      targetUserId: req.params.id,
      reason,
    });

    return sendSuccess(res, {
      success: true,
      message: result.message,
      data: result.summary,
    });
  },
  sendAdminFailure("KhÃƒÂ´ng thÃ¡Â»Æ’ xÃƒÂ³a tÃƒÂ i khoÃ¡ÂºÂ£n."),
);

export const updateUserRole = handleController(
  async (req, res) =>
    sendSuccess(res, {
      success: true,
      message: "Cáº­p nháº­t role thÃ nh cÃ´ng",
      data: await updateUserRoleLegacyCommand({
        userId: req.params.userId,
        role: req.body?.role,
      }),
    }),
  sendAdminFailure("KhÃ´ng thá»ƒ cáº­p nháº­t role", "Lá»—i khi cáº­p nháº­t role:"),
);

export const getFriendRequestsAdmin = handleController(
  async (req, res) =>
    sendSuccess(res, {
      success: true,
      data: await getFriendRequestsAdminQuery({ query: req.query }),
    }),
  sendAdminFailure(
    "KhÃ´ng thá»ƒ láº¥y danh sÃ¡ch lá»i má»i káº¿t báº¡n",
    "Lá»—i khi láº¥y danh sÃ¡ch lá»i má»i káº¿t báº¡n:",
  ),
);

export const getFriendships = handleController(
  async (req, res) =>
    sendSuccess(res, {
      success: true,
      data: await getFriendshipsAdminQuery({ query: req.query }),
    }),
  sendAdminFailure(
    "Khong the lay danh sach friendship da accepted",
    "Loi khi lay danh sach friendship da accepted:",
  ),
);

export const getConversations = handleController(
  async (req, res) =>
    sendSuccess(res, {
      success: true,
      data: await getConversationsAdminQuery({ query: req.query }),
    }),
  sendAdminFailure(
    "KhÃ´ng thá»ƒ láº¥y danh sÃ¡ch cuá»™c trÃ² chuyá»‡n",
    "Lá»—i khi láº¥y danh sÃ¡ch cuá»™c trÃ² chuyá»‡n:",
  ),
);

export const getMessages = handleController(
  async (req, res) =>
    sendSuccess(res, {
      success: true,
      data: await getAdminMessagesQuery({ query: req.query }),
    }),
  sendAdminFailure(
    "KhÃ´ng thá»ƒ láº¥y danh sÃ¡ch tin nháº¯n",
    "Lá»—i khi láº¥y danh sÃ¡ch tin nháº¯n:",
  ),
);

export const getBlockedUsers = handleController(
  async (req, res) =>
    sendSuccess(res, {
      success: true,
      data: await getAdminBlockedUsersQuery({ query: req.query }),
    }),
  sendAdminFailure(
    "KhÃ´ng thá»ƒ láº¥y danh sÃ¡ch khá»‘i ngÆ°á»i dÃ¹ng",
    "Lá»—i khi láº¥y danh sÃ¡ch khá»‘i ngÆ°á»i dÃ¹ng:",
  ),
);

export const getConversationDetail = handleController(
  async (req, res) =>
    sendSuccess(res, {
      success: true,
      data: await getConversationDetailAdminQuery({
        conversationId: req.params.id,
      }),
    }),
  sendAdminFailure(
    "KhÃ´ng thá»ƒ láº¥y chi tiáº¿t cuá»™c trÃ² chuyá»‡n",
    "Lá»—i khi láº¥y chi tiáº¿t cuá»™c trÃ² chuyá»‡n:",
  ),
);

export const getBlocks = handleController(
  async (req, res) =>
    sendSuccess(res, {
      success: true,
      data: await getBlocksAdminQuery({ query: req.query }),
    }),
  sendAdminFailure(
    "Khong the lay danh sach quan he chan",
    "Loi khi lay danh sach quan he chan:",
  ),
);

export const getBlockDetail = handleController(
  async (req, res) =>
    sendSuccess(res, {
      success: true,
      data: await getBlockDetailAdminQuery({ blockId: req.params.id }),
    }),
  sendAdminFailure(
    "Khong the lay chi tiet quan he chan.",
    "Loi khi lay chi tiet quan he chan:",
  ),
);

export const unblockBlockRelationAsAdmin = handleController(
  async (req, res) => {
    const result = await unblockBlockRelationAsAdminCommand({
      blockId: req.params.id,
    });

    return sendSuccess(res, {
      success: true,
      message: "Admin da go block relation thanh cong.",
      data: { block: result.block },
    });
  },
  sendAdminFailure(
    "Khong the go block relation.",
    "Loi khi admin go block relation:",
  ),
);

export const getReports = handleController(
  async (req, res) =>
    res.json({
      message: "Láº¥y danh sÃ¡ch bÃ¡o cÃ¡o thÃ nh cÃ´ng",
      data: await getReportsQuery(req.query),
    }),
  (error, _req, res) =>
    sendServerError(res, error, {
      logMessage: "Lá»—i khi láº¥y danh sÃ¡ch bÃ¡o cÃ¡o:",
      message: "KhÃ´ng thá»ƒ láº¥y danh sÃ¡ch bÃ¡o cÃ¡o",
    }),
);

export const getReportDetail = handleController(
  async (req, res) =>
    res.json({
      message: "Láº¥y chi tiáº¿t bÃ¡o cÃ¡o thÃ nh cÃ´ng",
      data: await getReportDetailQuery({ reportId: req.params.id }),
    }),
  (error, _req, res) =>
    sendServerError(res, error, {
      logMessage: "Lá»—i khi láº¥y chi tiáº¿t bÃ¡o cÃ¡o:",
      message: "KhÃ´ng thá»ƒ láº¥y chi tiáº¿t bÃ¡o cÃ¡o",
    }),
);

export const updateReportStatus = handleController(
  async (req, res) =>
    res.json({
      message: "Cáº­p nháº­t tráº¡ng thÃ¡i bÃ¡o cÃ¡o thÃ nh cÃ´ng",
      data: {
        report: await updateReportStatusCommand({
          reportId: req.params.id,
          status: req.body.status,
          resolutionNote: req.body.resolutionNote,
          adminId: req.user._id,
        }),
      },
    }),
  (error, _req, res) =>
    sendServerError(res, error, {
      logMessage: "Lá»—i khi cáº­p nháº­t tráº¡ng thÃ¡i bÃ¡o cÃ¡o:",
      message: "KhÃ´ng thá»ƒ cáº­p nháº­t tráº¡ng thÃ¡i bÃ¡o cÃ¡o",
    }),
);

export const resolveReportWithAction = handleController(
  async (req, res) =>
    res.json({
      message: "Xá»­ lÃ½ bÃ¡o cÃ¡o báº±ng hÃ nh Ä‘á»™ng thÃ nh cÃ´ng",
      data: await resolveReportWithActionCommand({
        reportId: req.params.id,
        action: req.body.action,
        resolutionNote: req.body.resolutionNote,
        adminId: req.user._id,
      }),
    }),
  (error, _req, res) =>
    sendServerError(res, error, {
      logMessage: "Lá»—i khi xá»­ lÃ½ bÃ¡o cÃ¡o báº±ng hÃ nh Ä‘á»™ng:",
      message: "KhÃ´ng thá»ƒ xá»­ lÃ½ bÃ¡o cÃ¡o báº±ng hÃ nh Ä‘á»™ng",
    }),
);

export const getSystemHealth = handleController(
  async (_req, res) => sendSuccess(res, await getSystemHealthSummary()),
  (error, _req, res) =>
    sendSuccess(
      res,
      {
        status: "unhealthy",
        message: error.message,
      },
      500,
    ),
);

export const getMaintenanceInfo = handleController(
  async (_req, res) => sendSuccess(res, await getMaintenanceInfoQuery()),
  sendAdminFailure("Lá»—i há»‡ thá»‘ng", "Lá»—i khi láº¥y thÃ´ng tin báº£o trÃ¬:"),
);

export const requestMaintenancePasswordVerification = handleController(
  async (req, res) =>
    sendSuccess(
      res,
      await requestMaintenancePasswordVerificationCommand({
        adminId: req.user._id,
      }),
    ),
  sendAdminFailure("Lá»—i há»‡ thá»‘ng", "Lá»—i khi yÃªu cáº§u xÃ¡c minh máº­t kháº©u:"),
);

export const verifyMaintenancePassword = handleController(
  async (req, res) =>
    sendSuccess(
      res,
      await verifyMaintenancePasswordCommand({
        adminId: req.user._id,
        password: req.body.password,
      }),
    ),
  sendAdminFailure(
    "Lá»—i há»‡ thá»‘ng",
    "Lá»—i khi xÃ¡c minh máº­t kháº©u báº£o trÃ¬:",
  ),
);

export const confirmMaintenanceToggle = handleController(
  async (req, res) =>
    sendSuccess(
      res,
      await confirmMaintenanceToggleCommand({
        adminId: req.user._id,
        code: req.body.code,
        enable: req.body.enable,
      }),
    ),
  (error, _req, res) =>
    sendSuccess(
      res,
      error.payload || { message: error.message || "Lá»—i há»‡ thá»‘ng" },
      error.status || 500,
    ),
);

export const updateMaintenanceMessage = handleController(
  async (req, res) =>
    sendSuccess(
      res,
      await updateMaintenanceMessageCommand({
        message: req.body.message,
      }),
    ),
  sendAdminFailure(
    "Lá»—i há»‡ thá»‘ng",
    "Lá»—i khi cáº­p nháº­t thÃ´ng bÃ¡o báº£o trÃ¬:",
  ),
);
