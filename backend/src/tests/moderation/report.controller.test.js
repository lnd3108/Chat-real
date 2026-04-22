import { jest } from "@jest/globals";

const mockCreateReportCommand = jest.fn();
const mockGetMyReportsQuery = jest.fn();

jest.unstable_mockModule("../../modules/moderation/application/report-user.service.js", () => ({
  createReportCommand: mockCreateReportCommand,
  getMyReportsQuery: mockGetMyReportsQuery,
}));

const {
  createReport,
  getMyReports,
} = await import("../../modules/moderation/api/http/report.controller.js");

const createRes = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };

  return res;
};

describe("moderation report controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates report through application service", async () => {
    mockCreateReportCommand.mockResolvedValue({ _id: "report-1" });

    const req = {
      user: { _id: "u1" },
      body: { targetType: "user", targetUserId: "u2", reason: "spam" },
    };
    const res = createRes();

    await createReport(req, res);

    expect(mockCreateReportCommand).toHaveBeenCalledWith({
      user: req.user,
      body: req.body,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: "TÃƒÂ¡Ã‚ÂºÃ‚Â¡o bÃƒÆ’Ã‚Â¡o cÃƒÆ’Ã‚Â¡o thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng",
      data: { report: { _id: "report-1" } },
    });
  });

  it("returns paginated report list from application service", async () => {
    mockGetMyReportsQuery.mockResolvedValue({
      reports: [{ _id: "report-1" }],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });

    const req = {
      user: { _id: "u1" },
      query: { page: "1", limit: "20", status: "pending", targetType: "user" },
    };
    const res = createRes();

    await getMyReports(req, res);

    expect(mockGetMyReportsQuery).toHaveBeenCalledWith({
      reporterId: "u1",
      page: "1",
      limit: "20",
      status: "pending",
      targetType: "user",
    });
    expect(res.json).toHaveBeenCalledWith({
      message: "LÃƒÂ¡Ã‚ÂºÃ‚Â¥y danh sÃƒÆ’Ã‚Â¡ch bÃƒÆ’Ã‚Â¡o cÃƒÆ’Ã‚Â¡o thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng",
      data: {
        reports: [{ _id: "report-1" }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      },
    });
  });
});
