import { jest } from "@jest/globals";

const mockConversationFindById = jest.fn();
const mockUserFindById = jest.fn();
const mockCallSessionCreate = jest.fn();
const mockCallSessionFindById = jest.fn();
const mockCallSessionFindOne = jest.fn();
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
    ACTIVE: "active",
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
  CALL_SESSION_MODES: {
    DIRECT: "direct",
    GROUP: "group",
  },
  CALL_PARTICIPANT_STATUSES: {
    INVITED: "invited",
    RINGING: "ringing",
    JOINED: "joined",
    DECLINED: "declined",
    MISSED: "missed",
    LEFT: "left",
  },
  default: {
    create: mockCallSessionCreate,
    findById: mockCallSessionFindById,
    findOne: mockCallSessionFindOne,
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

const {
  acceptCall,
  endCall,
  handleUserDisconnectedFromCalls,
  inviteCall,
  joinGroupVoiceCall,
  leaveGroupVoiceCall,
  rejectCall,
  relayGroupCallSignal,
  resetCallServiceStateForTests,
  startGroupVoiceCall,
} = await import("../../modules/calls/application/call.service.js");

describe("call service callType", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetCallServiceStateForTests();
    mockConversationFindById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      type: "direct",
      participants: [
        { userId: "507f1f77bcf86cd799439012" },
        { userId: "507f1f77bcf86cd799439013" },
      ],
      unreadCounts: new Map(),
      seenBy: [],
      save: jest.fn().mockResolvedValue(undefined),
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
    mockCallSessionFindOne.mockResolvedValue(null);
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

  it("calculates ended duration from acceptedAt, not startedAt", async () => {
    await inviteCall({
      callerId: "507f1f77bcf86cd799439012",
      conversationId: "507f1f77bcf86cd799439011",
      callType: "voice",
    });

    const acceptedAt = new Date("2026-05-18T00:00:10.000Z");
    const callSession = {
      _id: "507f1f77bcf86cd799439014",
      conversationId: "507f1f77bcf86cd799439011",
      callerId: "507f1f77bcf86cd799439012",
      receiverId: "507f1f77bcf86cd799439013",
      callType: "voice",
      status: "accepted",
      startedAt: new Date("2026-05-18T00:00:00.000Z"),
      acceptedAt,
      endedAt: null,
      durationSeconds: 0,
      endReason: null,
      save: jest.fn().mockImplementation(function save() {
        return Promise.resolve(this);
      }),
      toObject() {
        return this;
      },
    };
    mockCallSessionFindById.mockResolvedValueOnce(callSession);
    jest.setSystemTime(new Date("2026-05-18T00:01:15.000Z"));

    const result = await endCall({
      userId: "507f1f77bcf86cd799439012",
      callSessionId: "507f1f77bcf86cd799439014",
    });

    expect(result.error).toBeUndefined();
    expect(result.payload).toEqual(
      expect.objectContaining({
        status: "ended",
        durationSeconds: 65,
      }),
    );
    expect(callSession.durationSeconds).toBe(65);
  });

  it("keeps rejected call duration at zero", async () => {
    await inviteCall({
      callerId: "507f1f77bcf86cd799439012",
      conversationId: "507f1f77bcf86cd799439011",
      callType: "voice",
    });

    const result = await rejectCall({
      userId: "507f1f77bcf86cd799439013",
      callSessionId: "507f1f77bcf86cd799439014",
    });

    expect(result.error).toBeUndefined();
    expect(result.payload).toEqual(
      expect.objectContaining({
        status: "rejected",
        durationSeconds: 0,
      }),
    );
  });
});

describe("group voice call service", () => {
  const conversationId = "507f1f77bcf86cd799439101";
  const hostId = "507f1f77bcf86cd799439102";
  const memberId = "507f1f77bcf86cd799439103";
  const thirdMemberId = "507f1f77bcf86cd799439104";
  const outsiderId = "507f1f77bcf86cd799439105";
  const callSessionId = "507f1f77bcf86cd799439106";

  const buildGroupConversation = () => ({
    _id: conversationId,
    type: "group",
    group: { name: "Nhóm backend" },
    participants: [
      { userId: hostId },
      { userId: memberId },
      { userId: thirdMemberId },
    ],
    unreadCounts: new Map(),
    seenBy: [],
    save: jest.fn().mockResolvedValue(undefined),
  });

  const buildGroupCallSession = (overrides = {}) => ({
    _id: callSessionId,
    conversationId,
    callerId: hostId,
    initiatorId: hostId,
    hostId,
    callType: "voice",
    callMode: "group",
    status: "ringing",
    startedAt: new Date("2026-05-18T00:00:00.000Z"),
    acceptedAt: null,
    endedAt: null,
    durationSeconds: 0,
    endReason: null,
    participants: [
      {
        userId: hostId,
        status: "joined",
        invitedAt: new Date("2026-05-18T00:00:00.000Z"),
        joinedAt: new Date("2026-05-18T00:00:00.000Z"),
        leftAt: null,
        durationSeconds: 0,
      },
      {
        userId: memberId,
        status: "ringing",
        invitedAt: new Date("2026-05-18T00:00:00.000Z"),
        joinedAt: null,
        leftAt: null,
        durationSeconds: 0,
      },
      {
        userId: thirdMemberId,
        status: "ringing",
        invitedAt: new Date("2026-05-18T00:00:00.000Z"),
        joinedAt: null,
        leftAt: null,
        durationSeconds: 0,
      },
    ],
    save: jest.fn().mockImplementation(function save() {
      return Promise.resolve(this);
    }),
    toObject() {
      return this;
    },
    ...overrides,
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetCallServiceStateForTests();
    mockConversationFindById.mockResolvedValue(buildGroupConversation());
    mockUserFindById.mockImplementation(() => ({
      select: jest.fn().mockResolvedValue({
        _id: hostId,
        displayName: "Host",
        userName: "host",
        avatarUrl: null,
        status: "active",
        blockedUsers: [],
      }),
    }));
    mockCallSessionFindOne.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("starts a group voice call and emits incoming invitations", async () => {
    mockCallSessionCreate.mockImplementation(async (payload) => ({
      _id: callSessionId,
      ...payload,
      save: jest.fn(),
      toObject() {
        return this;
      },
    }));

    const result = await startGroupVoiceCall({
      userId: hostId,
      conversationId,
      callType: "voice",
    });

    expect(result.error).toBeUndefined();
    expect(mockCallSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        callMode: "group",
        callType: "voice",
        status: "ringing",
      }),
    );
    expect(mockEmitToUser).toHaveBeenCalledWith(
      memberId,
      "group-call:incoming",
      expect.objectContaining({
        callId: callSessionId,
        conversationId,
        callMode: "group",
        callType: "voice",
      }),
    );
  });

  it("cleans stale group calls before starting a new call", async () => {
    const staleCallSession = buildGroupCallSession({
      _id: "507f1f77bcf86cd799439109",
      status: "ringing",
      participants: [],
      save: jest.fn().mockImplementation(function save() {
        return Promise.resolve(this);
      }),
    });
    mockCallSessionFindOne.mockResolvedValueOnce(staleCallSession);
    mockCallSessionCreate.mockImplementation(async (payload) => ({
      _id: callSessionId,
      ...payload,
      save: jest.fn(),
      toObject() {
        return this;
      },
    }));

    const result = await startGroupVoiceCall({
      userId: hostId,
      conversationId,
      callType: "voice",
    });

    expect(result.error).toBeUndefined();
    expect(staleCallSession.status).toBe("ended");
    expect(staleCallSession.endedAt).toBeInstanceOf(Date);
    expect(mockCallSessionCreate).toHaveBeenCalled();
    expect(mockEmitToUser).toHaveBeenCalledWith(
      hostId,
      "group-call-cleaned",
      expect.objectContaining({ callSessionId: staleCallSession._id }),
    );
  });

  it("rejects group video calls", async () => {
    const result = await startGroupVoiceCall({
      userId: hostId,
      conversationId,
      callType: "video",
    });

    expect(result.error).toEqual(
      expect.objectContaining({ code: "GROUP_CALL_VIDEO_NOT_SUPPORTED" }),
    );
    expect(mockCallSessionCreate).not.toHaveBeenCalled();
  });

  it("joins a group call, marks it active with two joined participants, and enforces signaling target", async () => {
    const callSession = buildGroupCallSession();
    mockCallSessionFindById.mockResolvedValue(callSession);

    const joinResult = await joinGroupVoiceCall({
      userId: memberId,
      callSessionId,
    });

    expect(joinResult.error).toBeUndefined();
    expect(callSession.status).toBe("active");
    expect(callSession.acceptedAt).toBeInstanceOf(Date);
    expect(callSession.participants.find((p) => p.userId === memberId).status).toBe(
      "joined",
    );

    const relayResult = await relayGroupCallSignal({
      userId: memberId,
      callSessionId,
      targetUserId: hostId,
      eventName: "group-call:offer",
      signalPayload: { type: "offer" },
    });

    expect(relayResult.error).toBeUndefined();
    expect(mockEmitToUser).toHaveBeenCalledWith(
      hostId,
      "group-call:offer",
      expect.objectContaining({
        fromUserId: memberId,
        offer: { type: "offer" },
      }),
    );
  });

  it("blocks users outside the group from joining", async () => {
    const callSession = buildGroupCallSession();
    mockCallSessionFindById.mockResolvedValue(callSession);

    const result = await joinGroupVoiceCall({
      userId: outsiderId,
      callSessionId,
    });

    expect(result.error).toEqual(
      expect.objectContaining({ code: "GROUP_CALL_NOT_PARTICIPANT" }),
    );
  });

  it("blocks joins when group call participant limit is reached", async () => {
    const fourthMemberId = "507f1f77bcf86cd799439107";
    const fifthMemberId = "507f1f77bcf86cd799439108";
    mockConversationFindById.mockResolvedValue({
      ...buildGroupConversation(),
      participants: [
        { userId: hostId },
        { userId: memberId },
        { userId: thirdMemberId },
        { userId: fourthMemberId },
        { userId: fifthMemberId },
      ],
    });
    const callSession = buildGroupCallSession({
      participants: [
        { userId: hostId, status: "joined", joinedAt: new Date(), durationSeconds: 0 },
        { userId: memberId, status: "joined", joinedAt: new Date(), durationSeconds: 0 },
        { userId: thirdMemberId, status: "joined", joinedAt: new Date(), durationSeconds: 0 },
        { userId: fourthMemberId, status: "joined", joinedAt: new Date(), durationSeconds: 0 },
        { userId: fifthMemberId, status: "ringing", joinedAt: null, durationSeconds: 0 },
      ],
    });
    mockCallSessionFindById.mockResolvedValue(callSession);

    const result = await joinGroupVoiceCall({
      userId: fifthMemberId,
      callSessionId,
    });

    expect(result.error).toEqual(
      expect.objectContaining({ code: "GROUP_CALL_PARTICIPANT_LIMIT_REACHED" }),
    );
  });

  it("blocks group signaling to a participant who has not joined", async () => {
    const callSession = buildGroupCallSession({
      status: "active",
      participants: [
        { userId: hostId, status: "joined", joinedAt: new Date(), durationSeconds: 0 },
        { userId: memberId, status: "joined", joinedAt: new Date(), durationSeconds: 0 },
        { userId: thirdMemberId, status: "ringing", joinedAt: null, durationSeconds: 0 },
      ],
    });
    mockCallSessionFindById.mockResolvedValue(callSession);

    const result = await relayGroupCallSignal({
      userId: memberId,
      callSessionId,
      targetUserId: thirdMemberId,
      eventName: "group-call:offer",
      signalPayload: { type: "offer" },
    });

    expect(result.error).toEqual(
      expect.objectContaining({ code: "GROUP_CALL_SIGNALING_FORBIDDEN" }),
    );
  });

  it("cleans user busy state and blocks signaling after a participant leaves", async () => {
    const callSession = buildGroupCallSession();
    mockCallSessionFindById.mockResolvedValue(callSession);

    await joinGroupVoiceCall({ userId: memberId, callSessionId });

    const leaveResult = await leaveGroupVoiceCall({
      userId: memberId,
      callSessionId,
    });

    expect(leaveResult.error).toBeUndefined();
    expect(callSession.participants.find((p) => p.userId === memberId).status).toBe(
      "left",
    );
    expect(callSession.participants.find((p) => p.userId === memberId).leftAt).toBeInstanceOf(
      Date,
    );

    const relayResult = await relayGroupCallSignal({
      userId: memberId,
      callSessionId,
      targetUserId: hostId,
      eventName: "group-call:offer",
      signalPayload: { type: "offer" },
    });

    expect(relayResult.error).toEqual(
      expect.objectContaining({ code: "GROUP_CALL_SIGNALING_FORBIDDEN" }),
    );
  });

  it("disconnect cleanup marks the participant left and clears active call state", async () => {
    const callSession = buildGroupCallSession();
    mockCallSessionFindById.mockResolvedValue(callSession);

    await joinGroupVoiceCall({ userId: memberId, callSessionId });

    const result = await handleUserDisconnectedFromCalls(memberId);

    expect(result).toEqual(
      expect.objectContaining({
        callSessionId,
        userId: memberId,
      }),
    );
    expect(callSession.participants.find((p) => p.userId === memberId).status).toBe(
      "left",
    );

    const secondResult = await handleUserDisconnectedFromCalls(memberId);
    expect(secondResult).toBeNull();
  });
});
