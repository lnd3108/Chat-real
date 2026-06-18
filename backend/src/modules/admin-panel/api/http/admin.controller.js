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
  makeCommandHandler,
  makeQueryHandler,
} from "../../../../shared/api/http/controller-factory.js";
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

// Hàm xử lý để lấy thống kê tổng quan cho dashboard, bao gồm các số liệu chính như tổng người dùng, tổng tin nhắn, v.v.
export const getDashboardStats = makeQueryHandler({
  execute: async (req) => ({
    success: true,
    data: await getDashboardStatsSummary({
      query: req.query,
      adminContext: {
        role: req.user?.role,
        roles: req.user?.roles,
        permissions: req.user?.permissions,
      },
    }),
  }),
  present: (body) => presentJson({ body }),
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi lấy thống kê dashboard:",
    fallbackMessage: "Không thể lấy thống kê dashboard",
  }),
});

// Hàm xử lý để lấy danh sách người dùng với các bộ lọc và phân trang
export const getDashboardOverview = makeQueryHandler({
  execute: async (req) => ({
    success: true,
    data: await getDashboardOverviewSummary({
      query: req.query,
      adminContext: {
        role: req.user?.role,
        roles: req.user?.roles,
        permissions: req.user?.permissions,
      },
    }),
  }),
  present: (body) => presentJson({ body }),
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi lấy dashboard overview:",
    fallbackMessage: "Không thể lấy dữ liệu dashboard overview",
  }),
});

// Hàm xử lý để lấy biểu đồ thống kê người dùng theo thời gian
export const getDashboardUserChart = makeQueryHandler({
  execute: async (req) => ({
    success: true,
    data: await getDashboardUserChartData({ days: req.query.days }),
  }),
  present: (body) => presentJson({ body }),
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi lấy biểu đồ người dùng dashboard:",
    fallbackMessage: "Không thể lấy dữ liệu biểu đồ người dùng",
  }),
});

// Hàm xử lý để lấy biểu đồ thống kê tin nhắn theo thời gian
export const getDashboardMessageChart = makeQueryHandler({
  execute: async (req) => ({
    success: true,
    data: await getDashboardMessageChartData({ days: req.query.days }),
  }),
  present: (body) => presentJson({ body }),
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi lấy biểu đồ tin nhắn dashboard:",
    fallbackMessage: "Không thể lấy dữ liệu biểu đồ tin nhắn",
  }),
});

// Hàm xử lý để lấy biểu đồ thống kê báo cáo theo thời gian
export const getDashboardReportChart = makeQueryHandler({
  execute: async () => ({
    success: true,
    data: await getDashboardReportChartData(),
  }),
  present: (body) => presentJson({ body }),
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi lấy biểu đồ báo cáo dashboard:",
    fallbackMessage: "Không thể lấy dữ liệu biểu đồ báo cáo",
  }),
});

// Hàm xử lý để lấy biểu đồ thống kê hỗ trợ theo thời gian
export const getDashboardSupportChart = makeQueryHandler({
  execute: async () => ({
    success: true,
    data: await getDashboardSupportChartData(),
  }),
  present: (body) => presentJson({ body }),
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi lấy biểu đồ hỗ trợ dashboard:",
    fallbackMessage: "Không thể lấy dữ liệu biểu đồ hỗ trợ",
  }),
});

// Hàm xử lý để lấy danh sách role admin và role có thể gán được cho người dùng hiện tại
export const getUsers = makeQueryHandler({
  execute: (req) => getUsersQuery({ actor: req.user, query: req.query }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi lấy danh sách người dùng:",
    fallbackMessage: "Không thể lấy danh sách người dùng",
  }),
});

// Hàm xử lý để lấy thông tin chi tiết của một người dùng cụ thể
export const getUserDetail = makeQueryHandler({
  execute: (req) =>
    getUserDetailQuery({
      actor: req.user,
      userId: req.params.id,
    }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi lấy thông tin người dùng:",
    fallbackMessage: "Không thể lấy thông tin người dùng",
  }),
});

// Hàm xử lý để cập nhật trạng thái của một người dùng cụ thể (ví dụ: active, suspended, deleted)
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
    logMessage: "Lỗi khi cập nhật trạng thái người dùng:",
    fallbackMessage: "Không thể cập nhật trạng thái người dùng.",
  }),
});

// Hàm xử lý để xóa một người dùng cụ thể bởi admin
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
    fallbackMessage: "Không thể xóa tài khoản.",
  }),
});

// Hàm xử lý để cập nhật role của một người dùng cụ thể
export const updateUserRole = makeCommandHandler({
  execute: (req) =>
    updateUserRoleLegacyCommand({
      userId: req.params.userId,
      role: req.body?.role,
    }),
  present: (data) => presentSuccessMessage("Cập nhật role thành công", data),
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi cập nhật role:",
    fallbackMessage: "Không thể cập nhật role",
  }),
});

// Hàm xử lý để lấy danh sách lời mời kết bạn
export const getFriendRequestsAdmin = makeQueryHandler({
  execute: (req) => getFriendRequestsAdminQuery({ query: req.query }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi lấy danh sách lời mời kết bạn:",
    fallbackMessage: "Không thể lấy danh sách lời mời kết bạn",
  }),
});

// Hàm xử lý để lấy danh sách friendship đã accepted
export const getFriendships = makeQueryHandler({
  execute: (req) => getFriendshipsAdminQuery({ query: req.query }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi lấy danh sách friendship đã accepted:",
    fallbackMessage: "Không thể lấy danh sách friendship đã accepted",
  }),
});

// Hàm xử lý để lấy danh sách cuộc trò chuyện với các bộ lọc và phân trang
export const getConversations = makeQueryHandler({
  execute: (req) => getConversationsAdminQuery({ query: req.query }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi lấy danh sách cuộc trò chuyện:",
    fallbackMessage: "Không thể lấy danh sách cuộc trò chuyện",
  }),
});

// Hàm xử lý để lấy chi tiết một cuộc trò chuyện cụ thể, bao gồm thông tin người tham gia và lịch sử tin nhắn
export const getMessages = makeQueryHandler({
  execute: (req) => getAdminMessagesQuery({ query: req.query }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi lấy danh sách tin nhắn:",
    fallbackMessage: "Không thể lấy danh sách tin nhắn",
  }),
});

// Hàm xử lý để lấy danh sách người dùng bị block bởi admin
export const getBlockedUsers = makeQueryHandler({
  execute: (req) => getAdminBlockedUsersQuery({ query: req.query }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi lấy danh sách khối người dùng:",
    fallbackMessage: "Không thể lấy danh sách khối người dùng",
  }),
});

// Hàm xử lý để lấy chi tiết một cuộc trò chuyện cụ thể, bao gồm thông tin người tham gia và lịch sử tin nhắn
export const getConversationDetail = makeQueryHandler({
  execute: (req) =>
    getConversationDetailAdminQuery({
      conversationId: req.params.id,
    }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi lấy chi tiết cuộc trò chuyện:",
    fallbackMessage: "Không thể lấy chi tiết cuộc trò chuyện",
  }),
});

// Hàm xử lý để lấy chi tiết một quan hệ block cụ thể
export const getBlocks = makeQueryHandler({
  execute: (req) => getBlocksAdminQuery({ query: req.query }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi lấy danh sách quan hệ chặn:",
    fallbackMessage: "Không thể lấy danh sách quan hệ chặn",
  }),
});

// Hàm xử lý để lấy chi tiết một quan hệ block cụ thể
export const getBlockDetail = makeQueryHandler({
  execute: (req) => getBlockDetailAdminQuery({ blockId: req.params.id }),
  present: presentSuccessData,
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi lấy chi tiết quan hệ chặn:",
    fallbackMessage: "Không thể lấy chi tiết quan hệ chặn.",
  }),
});

// Hàm xử lý để admin gỡ block một quan hệ block cụ thể
export const unblockBlockRelationAsAdmin = makeCommandHandler({
  execute: (req) =>
    unblockBlockRelationAsAdminCommand({
      blockId: req.params.id,
    }),
  present: (result) =>
    presentSuccessMessage("Admin đã gỡ block relation thành công.", {
      block: result.block,
    }),
  onError: makeSuccessFlagErrorHandler({
    logMessage: "Lỗi khi admin gỡ block relation:",
    fallbackMessage: "Không thể gỡ block relation.",
  }),
});

// Hàm xử lý để lấy danh sách báo cáo với các bộ lọc và phân trang
export const getReports = makeQueryHandler({
  execute: (req) => getReportsQuery(req.query),
  present: (data) =>
    presentMessageData("Lấy danh sách báo cáo thành công", data),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi khi lấy danh sách báo cáo:",
    fallbackMessage: "Không thể lấy danh sách báo cáo",
  }),
});

// Hàm xử lý để lấy chi tiết một báo cáo cụ thể
export const getReportDetail = makeQueryHandler({
  execute: (req) => getReportDetailQuery({ reportId: req.params.id }),
  present: (data) =>
    presentMessageData("Lấy chi tiết báo cáo thành công", data),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi khi lấy chi tiết báo cáo:",
    fallbackMessage: "Không thể lấy chi tiết báo cáo",
  }),
});

// Hàm xử lý để cập nhật trạng thái của một báo cáo cụ thể (ví dụ: pending, resolved, rejected)
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
    presentMessageData("Cập nhật trạng thái báo cáo thành công", data),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi khi cập nhật trạng thái báo cáo:",
    fallbackMessage: "Không thể cập nhật trạng thái báo cáo",
  }),
});

// Hàm xử lý để admin gỡ block một quan hệ block cụ thể
export const resolveReportWithAction = makeCommandHandler({
  execute: (req) =>
    resolveReportWithActionCommand({
      reportId: req.params.id,
      action: req.body.action,
      resolutionNote: req.body.resolutionNote,
      adminId: req.user._id,
    }),
  present: (data) =>
    presentMessageData("Xử lý báo cáo bằng hành động thành công", data),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi khi xử lý báo cáo bằng hành động:",
    fallbackMessage: "Không thể xử lý báo cáo bằng hành động",
  }),
});

// Hàm xử lý để lấy thông tin sức khỏe hệ thống, bao gồm các chỉ số như CPU, RAM, disk usage, v.v.
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

// Hàm xử lý để lấy thông tin bảo trì hiện tại, bao gồm trạng thái bảo trì, thông báo bảo trì, v.v.
export const getMaintenanceInfo = makeQueryHandler({
  execute: () => getMaintenanceInfoQuery(),
  present: (body) => presentJson({ body }),
  onError: makeServerErrorHandler({
    logMessage: "Lỗi khi lấy thông tin bảo trì:",
    message: "Lỗi hệ thống",
  }),
});

// Hàm xử lý để yêu cầu xác minh mật khẩu trước khi bật/tắt chế độ bảo trì
export const requestMaintenancePasswordVerification = makeCommandHandler({
  execute: (req) =>
    requestMaintenancePasswordVerificationCommand({
      adminId: req.user._id,
    }),
  present: (body) => presentJson({ body }),
  onError: makeServerErrorHandler({
    logMessage: "Lỗi khi yêu cầu xác minh mật khẩu:",
    message: "Lỗi hệ thống",
  }),
});

// Hàm xử lý để xác minh mật khẩu bảo trì trước khi cho phép admin bật/tắt chế độ bảo trì
export const verifyMaintenancePassword = makeCommandHandler({
  execute: (req) =>
    verifyMaintenancePasswordCommand({
      adminId: req.user._id,
      password: req.body.password,
    }),
  present: (body) => presentJson({ body }),
  onError: makeServerErrorHandler({
    logMessage: "Lỗi khi xác minh mật khẩu bảo trì:",
    message: "Lỗi hệ thống",
  }),
});

// Hàm xử lý để admin xác nhận bật/tắt chế độ bảo trì sau khi đã xác minh mật khẩu thành công
export const confirmMaintenanceToggle = makeCommandHandler({
  execute: (req) =>
    confirmMaintenanceToggleCommand({
      adminId: req.user._id,
      code: req.body.code,
      enable: req.body.enable,
    }),
  present: (body) => presentJson({ body }),
  onError: makePayloadErrorHandler({
    fallbackMessage: "Lỗi hệ thống",
  }),
});

// Hàm xử lý để cập nhật thông báo bảo trì
export const updateMaintenanceMessage = makeCommandHandler({
  execute: (req) =>
    updateMaintenanceMessageCommand({
      message: req.body.message,
    }),
  present: (body) => presentJson({ body }),
  onError: makeServerErrorHandler({
    logMessage: "Lỗi khi cập nhật thông báo bảo trì:",
    message: "Lỗi hệ thống",
  }),
});
