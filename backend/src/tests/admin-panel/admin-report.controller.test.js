import { jest } from "@jest/globals";

const mockGetReportsQuery = jest.fn();
const mockGetReportDetailQuery = jest.fn();
const mockUpdateReportStatusCommand = jest.fn();
const mockResolveReportWithActionCommand = jest.fn();
const mockGetUsersQuery = jest.fn();
const mockGetUserDetailQuery = jest.fn();
const mockUpdateUserStatusCommand = jest.fn();
const mockDeleteUserAsAdminCommand = jest.fn();
const mockGetSystemHealthSummary = jest.fn();
const mockGetMaintenanceInfoQuery = jest.fn();
const mockRequestMaintenancePasswordVerificationCommand = jest.fn();
const mockVerifyMaintenancePasswordCommand = jest.fn();
const mockConfirmMaintenanceToggleCommand = jest.fn();
const mockUpdateMaintenanceMessageCommand = jest.fn();

jest.unstable_mockModule(
  "../../modules/moderation/application/report-admin.service.js",
  () => ({
    getReportDetailQuery: mockGetReportDetailQuery,
    getReportsQuery: mockGetReportsQuery,
    resolveReportWithActionCommand: mockResolveReportWithActionCommand,
    updateReportStatusCommand: mockUpdateReportStatusCommand,
  }),
);

jest.unstable_mockModule(
  "../../modules/admin-panel/application/dashboard.service.js",
  () => ({
    getDashboardOverviewSummary: jest.fn(),
    getDashboardStatsSummary: jest.fn(),
  }),
);

jest.unstable_mockModule(
  "../../modules/admin-panel/application/user-management.service.js",
  () => ({
    deleteUserAsAdminCommand: mockDeleteUserAsAdminCommand,
    getUserDetailQuery: mockGetUserDetailQuery,
    getUsersQuery: mockGetUsersQuery,
    updateUserStatusCommand: mockUpdateUserStatusCommand,
  }),
);

jest.unstable_mockModule(
  "../../modules/system/application/admin-maintenance.service.js",
  () => ({
    confirmMaintenanceToggleCommand: mockConfirmMaintenanceToggleCommand,
    getMaintenanceInfoQuery: mockGetMaintenanceInfoQuery,
    getSystemHealthSummary: mockGetSystemHealthSummary,
    requestMaintenancePasswordVerificationCommand:
      mockRequestMaintenancePasswordVerificationCommand,
    updateMaintenanceMessageCommand: mockUpdateMaintenanceMessageCommand,
    verifyMaintenancePasswordCommand: mockVerifyMaintenancePasswordCommand,
  }),
);

jest.unstable_mockModule("../../models/User.js", () => ({
  default: {
    countDocuments: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.unstable_mockModule("../../models/Conversation.js", () => ({
  default: {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
  },
}));

jest.unstable_mockModule("../../models/Message.js", () => ({
  default: {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.unstable_mockModule("../../models/FriendRequest.js", () => ({
  default: {
    countDocuments: jest.fn(),
    find: jest.fn(),
  },
}));

jest.unstable_mockModule("../../models/Friend.js", () => ({
  default: {
    countDocuments: jest.fn(),
    find: jest.fn(),
  },
}));

jest.unstable_mockModule("../../models/Blocking.js", () => ({
  BLOCKING_TYPE_DIRECT_ONLY: "direct_only",
  default: {
    countDocuments: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.unstable_mockModule("../../models/Session.js", () => ({
  default: {
    deleteMany: jest.fn(),
  },
}));

jest.unstable_mockModule("../../models/Report.js", () => ({
  default: {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.unstable_mockModule("../../socket/index.js", () => ({
  disconnectAllUserSockets: jest.fn(),
  disconnectUserSockets: jest.fn(),
  emitToUser: jest.fn(),
  getIo: jest.fn(() => ({ emit: jest.fn() })),
}));

jest.unstable_mockModule("../../services/accountDeletionService.js", () => ({
  permanentlyDeleteUserAccount: jest.fn(),
}));

jest.unstable_mockModule("../../utils/mail.js", () => ({
  isMailConfigured: jest.fn(() => true),
  sendAccountDeletedEmail: jest.fn(),
}));

jest.unstable_mockModule("../../modules/chat/api/http/conversation.controller.js", () => ({
  emitDirectBlockStatusChanged: jest.fn(),
}));

jest.unstable_mockModule("../../services/maintenanceService.js", () => ({
  getMaintenanceStatus: jest.fn(),
  requestPasswordVerification: jest.fn(),
  verifyPasswordAndPrepareConfirmation: jest.fn(),
  sendConfirmationCode: jest.fn(),
  verifyConfirmationCode: jest.fn(),
  toggleMaintenanceMode: jest.fn(),
  updateMaintenanceMessage: jest.fn(),
}));

jest.unstable_mockModule("../../constants/socketEvents.js", () => ({
  ADMIN_SOCKET_EVENTS: {},
  USER_SOCKET_EVENTS: {},
}));

jest.unstable_mockModule("../../shared/infrastructure/realtime/admin-room.js", () => ({
  emitToAdmins: jest.fn(),
}));

jest.unstable_mockModule("../../services/adminNotificationService.js", () => ({
  buildAdminActor: jest.fn(),
  emitAdminNotification: jest.fn(),
}));

jest.unstable_mockModule("../../services/dashboardRealtimeService.js", () => ({
  emitDashboardStatsUpdated: jest.fn(),
}));

jest.unstable_mockModule("../../utils/regex.js", () => ({
  escapeRegex: jest.fn((value) => value),
}));

jest.unstable_mockModule("../../services/adminQueryHelpers.js", () => ({
  buildAdminBlockFilter: jest.fn(),
  buildAdminFriendFilter: jest.fn(),
  buildAdminFriendRequestFilter: jest.fn(),
  getAdminBlockSort: jest.fn(),
  getAdminFriendRequestSort: jest.fn(),
  getAdminFriendSort: jest.fn(),
  mapAdminBlockRelation: jest.fn(),
  mapAdminFriendRelation: jest.fn(),
  mapAdminFriendRequestRelation: jest.fn(),
  mapAdminLastMessage: jest.fn(),
  syncBlockingDocumentsFromEmbeddedState: jest.fn(),
}));

jest.unstable_mockModule("../../services/rbacService.js", () => ({
  buildManageableUserFilter: jest.fn(),
  canManageUser: jest.fn(),
  serializeUserAccess: jest.fn((value) => value),
}));

jest.unstable_mockModule("../../utils/controllerResponses.js", () => ({
  sendServerError: jest.fn((res, _error, { message }) =>
    res.status(500).json({ message }),
  ),
}));

const {
  deleteUserAsAdmin,
  getMaintenanceInfo,
  getReports,
  getSystemHealth,
  getUserDetail,
  getUsers,
  getReportDetail,
  requestMaintenancePasswordVerification,
  updateMaintenanceMessage,
  updateReportStatus,
  updateUserStatus,
  verifyMaintenancePassword,
  confirmMaintenanceToggle,
  resolveReportWithAction,
} = await import("../../modules/admin-panel/api/http/admin.controller.js");

const createRes = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };

  return res;
};

describe("admin-panel report controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates getReports to moderation admin query service", async () => {
    mockGetReportsQuery.mockResolvedValue({
      reports: [{ _id: "r1" }],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });

    const req = { query: { status: "pending", q: "spam" } };
    const res = createRes();

    await getReports(req, res);

    expect(mockGetReportsQuery).toHaveBeenCalledWith(req.query);
    expect(res.json).toHaveBeenCalledWith({
      message: "Lấy danh sách báo cáo thành công",
      data: {
        reports: [{ _id: "r1" }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      },
    });
  });

  it("delegates getReportDetail to moderation admin query service", async () => {
    mockGetReportDetailQuery.mockResolvedValue({
      report: { _id: "r1" },
      moderationTargetUser: { _id: "u2" },
    });

    const req = { params: { id: "r1" } };
    const res = createRes();

    await getReportDetail(req, res);

    expect(mockGetReportDetailQuery).toHaveBeenCalledWith({ reportId: "r1" });
    expect(res.json).toHaveBeenCalledWith({
      message: "Lấy chi tiết báo cáo thành công",
      data: {
        report: { _id: "r1" },
        moderationTargetUser: { _id: "u2" },
      },
    });
  });

  it("delegates updateReportStatus to moderation command service", async () => {
    mockUpdateReportStatusCommand.mockResolvedValue({ _id: "r1", status: "resolved" });

    const req = {
      params: { id: "r1" },
      body: { status: "resolved", resolutionNote: "done" },
      user: { _id: "admin-1" },
    };
    const res = createRes();

    await updateReportStatus(req, res);

    expect(mockUpdateReportStatusCommand).toHaveBeenCalledWith({
      reportId: "r1",
      status: "resolved",
      resolutionNote: "done",
      adminId: "admin-1",
    });
    expect(res.json).toHaveBeenCalledWith({
      message: "Cập nhật trạng thái báo cáo thành công",
      data: { report: { _id: "r1", status: "resolved" } },
    });
  });

  it("delegates resolveReportWithAction to moderation command service", async () => {
    mockResolveReportWithActionCommand.mockResolvedValue({
      report: { _id: "r1", status: "resolved" },
      action: "Da khoa nguoi dung",
    });

    const req = {
      params: { id: "r1" },
      body: { action: "ban-user", resolutionNote: "spam" },
      user: { _id: "admin-1" },
    };
    const res = createRes();

    await resolveReportWithAction(req, res);

    expect(mockResolveReportWithActionCommand).toHaveBeenCalledWith({
      reportId: "r1",
      action: "ban-user",
      resolutionNote: "spam",
      adminId: "admin-1",
    });
    expect(res.json).toHaveBeenCalledWith({
      message: "Xử lý báo cáo bằng hành động thành công",
      data: {
        report: { _id: "r1", status: "resolved" },
        action: "Da khoa nguoi dung",
      },
    });
  });
});

describe("admin-panel user-management and maintenance controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates getUsers to user-management query service", async () => {
    mockGetUsersQuery.mockResolvedValue({
      users: [{ _id: "u1" }],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });

    const req = { user: { _id: "admin-1" }, query: { q: "tester" } };
    const res = createRes();

    await getUsers(req, res);

    expect(mockGetUsersQuery).toHaveBeenCalledWith({
      actor: req.user,
      query: req.query,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        users: [{ _id: "u1" }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      },
    });
  });

  it("delegates getUserDetail to user-management query service", async () => {
    mockGetUserDetailQuery.mockResolvedValue({
      user: { _id: "u1" },
      stats: { messagesCount: 10 },
    });

    const req = { user: { _id: "admin-1" }, params: { id: "u1" } };
    const res = createRes();

    await getUserDetail(req, res);

    expect(mockGetUserDetailQuery).toHaveBeenCalledWith({
      actor: req.user,
      userId: "u1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        user: { _id: "u1" },
        stats: { messagesCount: 10 },
      },
    });
  });

  it("delegates updateUserStatus to user-management command service", async () => {
    mockUpdateUserStatusCommand.mockResolvedValue({
      message: "locked",
      user: { _id: "u1", status: "banned" },
    });

    const req = {
      user: { _id: "admin-1" },
      params: { id: "u1" },
      body: { status: "banned" },
    };
    const res = createRes();

    await updateUserStatus(req, res);

    expect(mockUpdateUserStatusCommand).toHaveBeenCalledWith({
      actor: req.user,
      userId: "u1",
      status: "banned",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "locked",
      data: { user: { _id: "u1", status: "banned" } },
    });
  });

  it("delegates deleteUserAsAdmin to user-management command service", async () => {
    mockDeleteUserAsAdminCommand.mockResolvedValue({
      message: "deleted",
      summary: { deletedUserId: "u1" },
    });

    const req = {
      user: { _id: "admin-1" },
      params: { id: "u1" },
      body: { reason: "spam" },
    };
    const res = createRes();

    await deleteUserAsAdmin(req, res);

    expect(mockDeleteUserAsAdminCommand).toHaveBeenCalledWith({
      actor: req.user,
      targetUserId: "u1",
      reason: "spam",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "deleted",
      data: { deletedUserId: "u1" },
    });
  });

  it("delegates getSystemHealth to system application service", async () => {
    mockGetSystemHealthSummary.mockResolvedValue({ status: "healthy" });

    const res = createRes();
    await getSystemHealth({}, res);

    expect(mockGetSystemHealthSummary).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: "healthy" });
  });

  it("delegates maintenance info and verification flows to system service", async () => {
    mockGetMaintenanceInfoQuery.mockResolvedValue({ isEnabled: false });
    mockRequestMaintenancePasswordVerificationCommand.mockResolvedValue({
      message: "requested",
      email: "admin@example.com",
    });
    mockVerifyMaintenancePasswordCommand.mockResolvedValue({
      message: "sent",
      expiresAt: 123,
    });

    const infoRes = createRes();
    await getMaintenanceInfo({}, infoRes);
    expect(mockGetMaintenanceInfoQuery).toHaveBeenCalled();
    expect(infoRes.json).toHaveBeenCalledWith({ isEnabled: false });

    const requestReq = { user: { _id: "admin-1" } };
    const requestRes = createRes();
    await requestMaintenancePasswordVerification(requestReq, requestRes);
    expect(mockRequestMaintenancePasswordVerificationCommand).toHaveBeenCalledWith({
      adminId: "admin-1",
    });
    expect(requestRes.status).toHaveBeenCalledWith(200);

    const verifyReq = { user: { _id: "admin-1" }, body: { password: "secret" } };
    const verifyRes = createRes();
    await verifyMaintenancePassword(verifyReq, verifyRes);
    expect(mockVerifyMaintenancePasswordCommand).toHaveBeenCalledWith({
      adminId: "admin-1",
      password: "secret",
    });
    expect(verifyRes.status).toHaveBeenCalledWith(200);
    expect(verifyRes.json).toHaveBeenCalledWith({
      message: "sent",
      expiresAt: 123,
    });
  });

  it("delegates maintenance toggle and message update to system service", async () => {
    mockConfirmMaintenanceToggleCommand.mockResolvedValue({
      message: "maintenance on",
      isEnabled: true,
    });
    mockUpdateMaintenanceMessageCommand.mockResolvedValue({
      message: "updated",
      maintenanceMessage: "Soon",
    });

    const toggleReq = {
      user: { _id: "admin-1" },
      body: { code: "123456", enable: true },
    };
    const toggleRes = createRes();

    await confirmMaintenanceToggle(toggleReq, toggleRes);

    expect(mockConfirmMaintenanceToggleCommand).toHaveBeenCalledWith({
      adminId: "admin-1",
      code: "123456",
      enable: true,
    });
    expect(toggleRes.status).toHaveBeenCalledWith(200);
    expect(toggleRes.json).toHaveBeenCalledWith({
      message: "maintenance on",
      isEnabled: true,
    });

    const msgReq = { body: { message: "Soon" } };
    const msgRes = createRes();
    await updateMaintenanceMessage(msgReq, msgRes);

    expect(mockUpdateMaintenanceMessageCommand).toHaveBeenCalledWith({
      message: "Soon",
    });
    expect(msgRes.status).toHaveBeenCalledWith(200);
    expect(msgRes.json).toHaveBeenCalledWith({
      message: "updated",
      maintenanceMessage: "Soon",
    });
  });
});
