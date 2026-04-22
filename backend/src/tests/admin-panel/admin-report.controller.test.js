import { jest } from "@jest/globals";

const mockGetReportsQuery = jest.fn();
const mockGetReportDetailQuery = jest.fn();
const mockUpdateReportStatusCommand = jest.fn();
const mockResolveReportWithActionCommand = jest.fn();

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
  getReports,
  getReportDetail,
  updateReportStatus,
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
