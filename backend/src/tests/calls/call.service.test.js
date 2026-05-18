import { jest } from "@jest/globals";

const mockConversationFindById = jest.fn();
const mockUserFindById = jest.fn();
const mockCallSessionCreate = jest.fn();
const mockCallSessionFindById = jest.fn();
const mockEmitToUser = jest.fn();
const mockIsUserOnline = jest.fn();
const mockEnsureDirectMessagingAllowed = jest.fn();

jest.unstable_mockModule("../../models/Conversation.js", () => ({
  default: {
    findById: mockConversationFindById,
  },
}));

jest.unstable_mockModule("../../models/User.js", () => ({
  default: {
    findById: mockUserFindById,
  },
}));

jest.unstable_mockModule("../../models/Message.js", () => ({
  default: {
    create: jest.fn(),
  },
}));

jest.unstable_mockModule("../../models/CallSession.js", () => ({
  CALL_SESSION_STATUSES: {
    RINGING: "ringing",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
    MISSED: "missed",
    CANCELLED: "cancelled",
    ENDED: "ended",
    FAILED: "failed",
  },
  CALL_SESSION_TYPES: {
    VOICE: "voice",
    VIDEO: "video",
  },
  default: {
    create: mockCallSessionCreate,
    findById: mockCallSessionFindById,
  },
}));

jest.unstable_mockModule("../../modules/chat/domain/direct-blocking.policy.js", () => ({
  ensureDirectMessagingAllowed: mockEnsureDirectMessagingAllowed,
}));

jest.unstable_mockModule("../../modules/chat/infrastructure/realtime/message-realtime.js", () => ({
  emitNewMessage: jest.fn(),
  updateConversationAfterCreateMessage: jest.fn(),
}));

jest.unstable_mockModule("../../shared/infrastructure/realtime/socket-gateway.js", () => ({
  emitToUser: mockEmitToUser,
}));

jest.unstable_mockModule("../../shared/infrastructure/realtime/socket-registry.js", () => ({
  getIo: jest.fn(() => null),
}));

jest.unstable_mockModule("../../shared/infrastructure/realtime/user-presence.js", () => ({
  isUserOnline: mockIsUserOnline,
}));

const { acceptCall, inviteCall } = await import("../../modules/calls/application/call.service.js");

describe("call service callType", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockConversationFindById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      type: "direct",
      participants: [
        { userId: "507f1f77bcf86cd799439012" },
        { userId: "507f1f77bcf86cd799439013" },
      ],
    });
    mockUserFindById.mockImplementation(() => ({
      select: jest.fn().mockResolvedValue({ blockedUsers: [] }),
    }));
    mockEnsureDirectMessagingAllowed.mockReturnValue({ allowed: true });
    mockIsUserOnline.mockReturnValue(true);
    mockCallSessionCreate.mockImplementation(async (payload) => ({
      _id: "507f1f77bcf86cd799439014",
      ...payload,
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-18T00:00:00.000Z"),
    }));
    mockCallSessionFindById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439014",
      conversationId: "507f1f77bcf86cd799439011",
      callerId: "507f1f77bcf86cd799439012",
      receiverId: "507f1f77bcf86cd799439013",
      callType: "video",
      status: "ringing",
      startedAt: new Date("2026-05-18T00:00:00.000Z"),
      acceptedAt: null,
      endedAt: null,
      durationSeconds: 0,
      endReason: null,
      save: jest.fn().mockImplementation(function save() {
        return Promise.resolve(this);
      }),
      toObject() {
        return this;
      },
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("creates video call sessions and emits incoming payload with callType", async () => {
    const result = await inviteCall({
      callerId: "507f1f77bcf86cd799439012",
      conversationId: "507f1f77bcf86cd799439011",
      callType: "video",
    });

    expect(result.error).toBeUndefined();
    expect(mockCallSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        callType: "video",
        receiverId: "507f1f77bcf86cd799439013",
        status: "ringing",
      }),
    );
    expect(result.payload).toEqual(
      expect.objectContaining({
        callType: "video",
        receiverId: "507f1f77bcf86cd799439013",
      }),
    );
    expect(mockEmitToUser).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439013",
      "call:incoming",
      expect.objectContaining({ callType: "video" }),
    );
  });

  it("rejects invalid callType before creating a call session", async () => {
    const result = await inviteCall({
      callerId: "507f1f77bcf86cd799439012",
      conversationId: "507f1f77bcf86cd799439011",
      callType: "screen",
    });

    expect(result.error).toEqual(
      expect.objectContaining({ code: "CALL_INVALID_TYPE" }),
    );
    expect(mockCallSessionCreate).not.toHaveBeenCalled();
  });

  it("keeps callType in accepted payload", async () => {
    await inviteCall({
      callerId: "507f1f77bcf86cd799439012",
      conversationId: "507f1f77bcf86cd799439011",
      callType: "video",
    });

    const result = await acceptCall({
      userId: "507f1f77bcf86cd799439013",
      callSessionId: "507f1f77bcf86cd799439014",
    });

    expect(result.error).toBeUndefined();
    expect(result.payload).toEqual(expect.objectContaining({ callType: "video" }));
    expect(mockEmitToUser).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439012",
      "call:accepted",
      expect.objectContaining({ callType: "video" }),
    );
  });
});
