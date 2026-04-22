import { jest } from "@jest/globals";

const mockGetAuthMe = jest.fn();
const mockBlockUserCommand = jest.fn();

jest.unstable_mockModule("../../modules/user-profile/application/user-profile.service.js", () => ({
  blockUserCommand: mockBlockUserCommand,
  cancelEmailChangeCommand: jest.fn(),
  deleteMyAccountCommand: jest.fn(),
  getAuthMe: mockGetAuthMe,
  getBlockedUsersQuery: jest.fn(),
  getUserSuggestionsQuery: jest.fn(),
  searchUsersQuery: jest.fn(),
  sendEmailChangeOtpCommand: jest.fn(),
  unblockUserCommand: jest.fn(),
  updatePreferencesCommand: jest.fn(),
  updateProfileCommand: jest.fn(),
  uploadAvatarCommand: jest.fn(),
  verifyEmailChangeCommand: jest.fn(),
}));

jest.unstable_mockModule("../../shared/infrastructure/logger/logger.js", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const {
  authMe,
  blockUser,
} = await import("../../modules/user-profile/api/http/user.controller.js");

const createRes = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };

  return res;
};

describe("user-profile controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns authMe payload from application service", async () => {
    mockGetAuthMe.mockResolvedValue({
      user: { _id: "u1", displayName: "Tester" },
    });

    const req = { user: { _id: "u1" } };
    const res = createRes();

    await authMe(req, res);

    expect(mockGetAuthMe).toHaveBeenCalledWith({ user: req.user });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      user: { _id: "u1", displayName: "Tester" },
    });
  });

  it("preserves blockUser validation response from application layer", async () => {
    mockBlockUserCommand.mockResolvedValue({
      error: { status: 409, message: "Already blocked" },
    });

    const req = {
      user: { _id: "u1" },
      params: { targetUserId: "u2" },
      body: { reason: "spam" },
    };
    const res = createRes();

    await blockUser(req, res);

    expect(mockBlockUserCommand).toHaveBeenCalledWith({
      user: req.user,
      targetUserId: "u2",
      reason: "spam",
    });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "Already blocked" });
  });
});
