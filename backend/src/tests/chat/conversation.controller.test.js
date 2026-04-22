import { jest } from "@jest/globals";

const mockCreateConversationCommand = jest.fn();
const mockGetConversationMessagesForUser = jest.fn();

jest.unstable_mockModule(
  "../../modules/chat/application/conversation.command-service.js",
  () => ({
    addGroupMembersCommand: jest.fn(),
    createConversationCommand: mockCreateConversationCommand,
    deleteOrLeaveConversationCommand: jest.fn(),
    emitDirectBlockStatusChanged: jest.fn(),
    markConversationSeenCommand: jest.fn(),
    removeGroupMemberCommand: jest.fn(),
    updateGroupNameCommand: jest.fn(),
    uploadGroupAvatarCommand: jest.fn(),
  }),
);

jest.unstable_mockModule(
  "../../modules/chat/application/conversation.query-service.js",
  () => ({
    getConversationListForUser: jest.fn(),
    getConversationMessagesForUser: mockGetConversationMessagesForUser,
    getGroupDetailsForUser: jest.fn(),
    getUserConversationIdsForRealtime: jest.fn(),
  }),
);

const {
  createConversation,
  getMessages,
} = await import("../../modules/chat/api/http/conversation.controller.js");

const createRes = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };

  return res;
};

describe("chat conversation controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates createConversation to command service and preserves payload", async () => {
    mockCreateConversationCommand.mockResolvedValue({
      status: 201,
      payload: { message: "created", conversation: { _id: "c1" } },
    });

    const req = {
      user: { _id: "u1" },
      body: { type: "direct", participantIds: ["u2"] },
    };
    const res = createRes();

    await createConversation(req, res);

    expect(mockCreateConversationCommand).toHaveBeenCalledWith({
      user: req.user,
      body: req.body,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: "created",
      conversation: { _id: "c1" },
    });
  });

  it("maps query-service authorization errors for getMessages", async () => {
    mockGetConversationMessagesForUser.mockResolvedValue({
      error: { status: 403, message: "Forbidden" },
    });

    const req = {
      user: { _id: "u1" },
      params: { conversationId: "c1" },
      query: { limit: "20", cursor: "abc" },
    };
    const res = createRes();

    await getMessages(req, res);

    expect(mockGetConversationMessagesForUser).toHaveBeenCalledWith({
      user: req.user,
      conversationId: "c1",
      limit: "20",
      cursor: "abc",
    });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Forbidden" });
  });
});
