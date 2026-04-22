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
import { sendServerError } from "../../../../utils/controllerResponses.js";

const sendSuccess = (res, data, status = 200) => res.status(status).json(data);

export const getDashboardStats = async (_req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      data: await getDashboardStatsSummary(),
    });
  } catch (error) {
    console.error("Lá»—i khi láº¥y thá»‘ng kÃª dashboard:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: "KhÃ´ng thá»ƒ láº¥y thá»‘ng kÃª dashboard",
      },
      500,
    );
  }
};

export const getDashboardOverview = async (_req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      data: await getDashboardOverviewSummary(),
    });
  } catch (error) {
    console.error("Loi khi lay dashboard overview:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: "Khong the lay du lieu dashboard overview",
      },
      500,
    );
  }
};

export const getDashboardUserChart = async (req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      data: await getDashboardUserChartData({ days: req.query.days }),
    });
  } catch (error) {
    console.error("Loi khi lay chart user dashboard:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: "Khong the lay du lieu chart nguoi dung",
      },
      500,
    );
  }
};

export const getDashboardMessageChart = async (req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      data: await getDashboardMessageChartData({ days: req.query.days }),
    });
  } catch (error) {
    console.error("Loi khi lay chart message dashboard:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: "Khong the lay du lieu chart tin nhan",
      },
      500,
    );
  }
};

export const getDashboardReportChart = async (_req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      data: await getDashboardReportChartData(),
    });
  } catch (error) {
    console.error("Loi khi lay chart report dashboard:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: "Khong the lay du lieu chart bao cao",
      },
      500,
    );
  }
};

export const getDashboardSupportChart = async (_req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      data: await getDashboardSupportChartData(),
    });
  } catch (error) {
    console.error("Loi khi lay chart support dashboard:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: "Khong the lay du lieu chart ho tro",
      },
      500,
    );
  }
};

export const getUsers = async (req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      data: await getUsersQuery({ actor: req.user, query: req.query }),
    });
  } catch (error) {
    console.error("Lá»—i khi láº¥y danh sÃ¡ch ngÆ°á»i dÃ¹ng:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: "KhÃ´ng thá»ƒ láº¥y danh sÃ¡ch ngÆ°á»i dÃ¹ng",
      },
      500,
    );
  }
};

export const getUserDetail = async (req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      data: await getUserDetailQuery({
        actor: req.user,
        userId: req.params.id,
      }),
    });
  } catch (error) {
    console.error("LÃ¡Â»â€”i khi lÃ¡ÂºÂ¥y thÃƒÂ´ng tin ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: error.message || "KhÃƒÂ´ng thÃ¡Â»Æ’ lÃ¡ÂºÂ¥y thÃƒÂ´ng tin ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng",
      },
      error.status || 500,
    );
  }
};

export const updateUserStatus = async (req, res) => {
  try {
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
  } catch (error) {
    console.error("LÃ¡Â»â€”i khi cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t trÃ¡ÂºÂ¡ng thÃƒÂ¡i ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message:
          error.message ||
          "KhÃƒÂ´ng thÃ¡Â»Æ’ cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t trÃ¡ÂºÂ¡ng thÃƒÂ¡i ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng.",
      },
      error.status || 500,
    );
  }
};

export const deleteUserAsAdmin = async (req, res) => {
  try {
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
  } catch (error) {
    return sendSuccess(
      res,
      {
        success: false,
        message: error.message || "KhÃƒÂ´ng thÃ¡Â»Æ’ xÃƒÂ³a tÃƒÂ i khoÃ¡ÂºÂ£n.",
      },
      error.status || 500,
    );
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const user = await updateUserRoleLegacyCommand({
      userId: req.params.userId,
      role: req.body?.role,
    });

    return sendSuccess(res, {
      success: true,
      message: "Cáº­p nháº­t role thÃ nh cÃ´ng",
      data: user,
    });
  } catch (error) {
    console.error("Lá»—i khi cáº­p nháº­t role:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: error.message || "KhÃ´ng thá»ƒ cáº­p nháº­t role",
      },
      error.status || 500,
    );
  }
};

export const getFriendRequestsAdmin = async (req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      data: await getFriendRequestsAdminQuery({ query: req.query }),
    });
  } catch (error) {
    console.error("Lá»—i khi láº¥y danh sÃ¡ch lá»i má»i káº¿t báº¡n:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: "KhÃ´ng thá»ƒ láº¥y danh sÃ¡ch lá»i má»i káº¿t báº¡n",
      },
      500,
    );
  }
};

export const getFriendships = async (req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      data: await getFriendshipsAdminQuery({ query: req.query }),
    });
  } catch (error) {
    console.error("Loi khi lay danh sach friendship da accepted:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: "Khong the lay danh sach friendship da accepted",
      },
      500,
    );
  }
};

export const getConversations = async (req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      data: await getConversationsAdminQuery({ query: req.query }),
    });
  } catch (error) {
    console.error("Lá»—i khi láº¥y danh sÃ¡ch cuá»™c trÃ² chuyá»‡n:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: "KhÃ´ng thá»ƒ láº¥y danh sÃ¡ch cuá»™c trÃ² chuyá»‡n",
      },
      500,
    );
  }
};

export const getMessages = async (req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      data: await getAdminMessagesQuery({ query: req.query }),
    });
  } catch (error) {
    console.error("Lá»—i khi láº¥y danh sÃ¡ch tin nháº¯n:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: "KhÃ´ng thá»ƒ láº¥y danh sÃ¡ch tin nháº¯n",
      },
      500,
    );
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      data: await getAdminBlockedUsersQuery({ query: req.query }),
    });
  } catch (error) {
    console.error("Lá»—i khi láº¥y danh sÃ¡ch khá»‘i ngÆ°á»i dÃ¹ng:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: "KhÃ´ng thá»ƒ láº¥y danh sÃ¡ch khá»‘i ngÆ°á»i dÃ¹ng",
      },
      500,
    );
  }
};

export const getConversationDetail = async (req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      data: await getConversationDetailAdminQuery({
        conversationId: req.params.id,
      }),
    });
  } catch (error) {
    console.error("Lá»—i khi láº¥y chi tiáº¿t cuá»™c trÃ² chuyá»‡n:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: error.message || "KhÃ´ng thá»ƒ láº¥y chi tiáº¿t cuá»™c trÃ² chuyá»‡n",
      },
      error.status || 500,
    );
  }
};

export const getBlocks = async (req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      data: await getBlocksAdminQuery({ query: req.query }),
    });
  } catch (error) {
    console.error("Loi khi lay danh sach quan he chan:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: "Khong the lay danh sach quan he chan",
      },
      500,
    );
  }
};

export const getBlockDetail = async (req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      data: await getBlockDetailAdminQuery({ blockId: req.params.id }),
    });
  } catch (error) {
    console.error("Loi khi lay chi tiet quan he chan:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: error.message || "Khong the lay chi tiet quan he chan.",
      },
      error.status || 500,
    );
  }
};

export const unblockBlockRelationAsAdmin = async (req, res) => {
  try {
    return sendSuccess(res, {
      success: true,
      message: "Admin da go block relation thanh cong.",
      data: {
        block: (await unblockBlockRelationAsAdminCommand({ blockId: req.params.id })).block,
      },
    });
  } catch (error) {
    console.error("Loi khi admin go block relation:", error);
    return sendSuccess(
      res,
      {
        success: false,
        message: error.message || "Khong the go block relation.",
      },
      error.status || 500,
    );
  }
};

export const getReports = async (req, res) => {
  try {
    return res.json({
      message: "Láº¥y danh sÃ¡ch bÃ¡o cÃ¡o thÃ nh cÃ´ng",
      data: await getReportsQuery(req.query),
    });
  } catch (error) {
    return sendServerError(res, error, {
      logMessage: "Lá»—i khi láº¥y danh sÃ¡ch bÃ¡o cÃ¡o:",
      message: "KhÃ´ng thá»ƒ láº¥y danh sÃ¡ch bÃ¡o cÃ¡o",
    });
  }
};

export const getReportDetail = async (req, res) => {
  try {
    return res.json({
      message: "Láº¥y chi tiáº¿t bÃ¡o cÃ¡o thÃ nh cÃ´ng",
      data: await getReportDetailQuery({ reportId: req.params.id }),
    });
  } catch (error) {
    return sendServerError(res, error, {
      logMessage: "Lá»—i khi láº¥y chi tiáº¿t bÃ¡o cÃ¡o:",
      message: "KhÃ´ng thá»ƒ láº¥y chi tiáº¿t bÃ¡o cÃ¡o",
    });
  }
};

export const updateReportStatus = async (req, res) => {
  try {
    const report = await updateReportStatusCommand({
      reportId: req.params.id,
      status: req.body.status,
      resolutionNote: req.body.resolutionNote,
      adminId: req.user._id,
    });

    return res.json({
      message: "Cáº­p nháº­t tráº¡ng thÃ¡i bÃ¡o cÃ¡o thÃ nh cÃ´ng",
      data: { report },
    });
  } catch (error) {
    return sendServerError(res, error, {
      logMessage: "Lá»—i khi cáº­p nháº­t tráº¡ng thÃ¡i bÃ¡o cÃ¡o:",
      message: "KhÃ´ng thá»ƒ cáº­p nháº­t tráº¡ng thÃ¡i bÃ¡o cÃ¡o",
    });
  }
};

export const resolveReportWithAction = async (req, res) => {
  try {
    return res.json({
      message: "Xá»­ lÃ½ bÃ¡o cÃ¡o báº±ng hÃ nh Ä‘á»™ng thÃ nh cÃ´ng",
      data: await resolveReportWithActionCommand({
        reportId: req.params.id,
        action: req.body.action,
        resolutionNote: req.body.resolutionNote,
        adminId: req.user._id,
      }),
    });
  } catch (error) {
    return sendServerError(res, error, {
      logMessage: "Lá»—i khi xá»­ lÃ½ bÃ¡o cÃ¡o báº±ng hÃ nh Ä‘á»™ng:",
      message: "KhÃ´ng thá»ƒ xá»­ lÃ½ bÃ¡o cÃ¡o báº±ng hÃ nh Ä‘á»™ng",
    });
  }
};

export const getSystemHealth = async (_req, res) => {
  try {
    return sendSuccess(res, await getSystemHealthSummary());
  } catch (error) {
    console.error("Error checking system health:", error);
    return sendSuccess(
      res,
      {
        status: "unhealthy",
        message: error.message,
      },
      500,
    );
  }
};

export const getMaintenanceInfo = async (_req, res) => {
  try {
    return sendSuccess(res, await getMaintenanceInfoQuery());
  } catch (error) {
    console.error("Lá»—i khi láº¥y thÃ´ng tin báº£o trÃ¬:", error);
    return sendSuccess(res, { message: "Lá»—i há»‡ thá»‘ng" }, 500);
  }
};

export const requestMaintenancePasswordVerification = async (req, res) => {
  try {
    return sendSuccess(
      res,
      await requestMaintenancePasswordVerificationCommand({
        adminId: req.user._id,
      }),
    );
  } catch (error) {
    console.error("Lá»—i khi yÃªu cáº§u xÃ¡c minh máº­t kháº©u:", error);
    return sendSuccess(
      res,
      { message: error.message || "Lá»—i há»‡ thá»‘ng" },
      error.status || 500,
    );
  }
};

export const verifyMaintenancePassword = async (req, res) => {
  try {
    return sendSuccess(
      res,
      await verifyMaintenancePasswordCommand({
        adminId: req.user._id,
        password: req.body.password,
      }),
    );
  } catch (error) {
    console.error("Lá»—i khi xÃ¡c minh máº­t kháº©u báº£o trÃ¬:", {
      adminId: req.user?._id,
      error: error.message,
      code: error.code,
      stack: error.stack,
    });
    return sendSuccess(
      res,
      { message: error.message || "Lá»—i há»‡ thá»‘ng" },
      error.status || 500,
    );
  }
};

export const confirmMaintenanceToggle = async (req, res) => {
  try {
    return sendSuccess(
      res,
      await confirmMaintenanceToggleCommand({
        adminId: req.user._id,
        code: req.body.code,
        enable: req.body.enable,
      }),
    );
  } catch (error) {
    console.error("Lá»—i khi xÃ¡c nháº­n thay Ä‘á»•i tráº¡ng thÃ¡i báº£o trÃ¬:", error);
    return sendSuccess(
      res,
      error.payload || { message: error.message || "Lá»—i há»‡ thá»‘ng" },
      error.status || 500,
    );
  }
};

export const updateMaintenanceMessage = async (req, res) => {
  try {
    return sendSuccess(
      res,
      await updateMaintenanceMessageCommand({
        message: req.body.message,
      }),
    );
  } catch (error) {
    console.error("Lá»—i khi cáº­p nháº­t thÃ´ng bÃ¡o báº£o trÃ¬:", error);
    return sendSuccess(
      res,
      { message: error.message || "Lá»—i há»‡ thá»‘ng" },
      error.status || 500,
    );
  }
};
