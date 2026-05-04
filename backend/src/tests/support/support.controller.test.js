import { jest } from "@jest/globals";

const mockGetOrCreateSupportConversationForUser = jest.fn();
const mockSendSupportMessageCommand = jest.fn();

jest.unstable_mockModule("../../modules/support/application/support-user.service.js", () => ({
  deleteSupportConversationForUser: jest.fn(),
  getOrCreateSupportConversationForUser: mockGetOrCreateSupportConversationForUser,
  getSupportConversationDetailForUser: jest.fn(),
  getUserSupportConversationsQuery: jest.fn(),
  sendSupportMessageCommand: mockSendSupportMessageCommand,
}));

const {
  getOrCreateSupportConversation,
  sendSupportMessage,
} = await import("../../modules/support/api/http/support.controller.js");

const createRes = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };

  return res;
};

describe("support controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns support conversation from application service", async () => {
    mockGetOrCreateSupportConversationForUser.mockResolvedValue({ _id: "support-1" });

    const req = { user: { _id: "u1" } };
    const res = createRes();

    await getOrCreateSupportConversation(req, res);

    expect(mockGetOrCreateSupportConversationForUser).toHaveBeenCalledWith({
      user: req.user,
    });
    expect(res.json).toHaveBeenCalledWith({
      message: "Lấy cuộc trò chuyện hỗ trợ thành công",
      data: { conversation: { _id: "support-1" } },
    });
  });

  it("maps application validation error when sending support message", async () => {
    const error = new Error("Missing content");
    error.status = 400;
    mockSendSupportMessageCommand.mockRejectedValue(error);

    const req = {
      user: { _id: "u1" },
      body: { conversationId: "support-1", content: "" },
    };
    const res = createRes();

    await sendSupportMessage(req, res);

    expect(mockSendSupportMessageCommand).toHaveBeenCalledWith({
      user: req.user,
      conversationId: "support-1",
      content: "",
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Missing content" });
  });
});
