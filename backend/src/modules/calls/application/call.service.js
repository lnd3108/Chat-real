import mongoose from "mongoose";
import Conversation from "../../../models/Conversation.js";
import Message from "../../../models/Message.js";
import User from "../../../models/User.js";
import CallSession from "../../../models/CallSession.js";
import { ensureDirectMessagingAllowed } from "../../chat/domain/direct-blocking.policy.js";
import {
  emitNewMessage,
  updateConversationAfterCreateMessage,
} from "../../chat/infrastructure/realtime/message-realtime.js";
import { CALL_SOCKET_EVENTS } from "../../../shared/domain/constants/socket-events.js";
import { emitToUser } from "../../../shared/infrastructure/realtime/socket-gateway.js";
import { getIo } from "../../../shared/infrastructure/realtime/socket-registry.js";
import { isUserOnline } from "../../../shared/infrastructure/realtime/user-presence.js";
import {
  CALL_END_REASONS,
  CALL_ERROR_CODES,
  CALL_MODES,
  CALL_PARTICIPANT_STATUS,
  GROUP_CALL_END_GRACE_MS,
  GROUP_CALL_INVITE_TIMEOUT_MS,
  CALL_RING_TIMEOUT_MS,
  CALL_STATUSES,
  CALL_TYPES,
  MAX_GROUP_CALL_PARTICIPANTS,
} from "../domain/call.constants.js";

const activeCallsByUser = new Map();
const activeCallIds = new Set();
const timeoutByCallId = new Map();
const activeGroupCallsByConversationId = new Map();
const groupInviteTimeoutsByCallId = new Map();
const groupEndGraceTimeoutByCallId = new Map();

const terminalStatuses = new Set([
  CALL_STATUSES.REJECTED,
  CALL_STATUSES.MISSED,
  CALL_STATUSES.CANCELLED,
  CALL_STATUSES.ENDED,
  CALL_STATUSES.FAILED,
]);

const groupLiveStatuses = new Set([
  CALL_STATUSES.RINGING,
  CALL_STATUSES.ACTIVE,
]);

const toIdString = (value) => {
  if (!value) return "";
  return value.toString ? value.toString() : String(value);
};

const buildError = (code, message) => ({ code, message });
const isValidId = (value) => mongoose.isValidObjectId(value);
const normalizeCallType = (callType) => callType ?? CALL_TYPES.VOICE;
const isValidCallType = (callType) => Object.values(CALL_TYPES).includes(callType);
const getCallRoomId = (callSessionId) => `group-call:${callSessionId}`;

const isGroupCall = (callSession) =>
  (callSession?.callMode ?? CALL_MODES.DIRECT) === CALL_MODES.GROUP;

const getParticipant = (callSession, userId) =>
  callSession.participants?.find(
    (participant) => toIdString(participant.userId) === toIdString(userId),
  );

const getJoinedParticipants = (callSession) =>
  (callSession.participants ?? []).filter(
    (participant) => participant.status === CALL_PARTICIPANT_STATUS.JOINED,
  );

const getJoinedParticipantIds = (callSession) =>
  getJoinedParticipants(callSession).map((participant) => toIdString(participant.userId));

const userBelongsToConversation = (conversation, userId) =>
  conversation.participants.some(
    (participant) => toIdString(participant.userId) === toIdString(userId),
  );

const normalizeCallSession = (callSession) => {
  if (!callSession) return null;
  const raw = callSession.toObject ? callSession.toObject() : callSession;

  return {
    callSessionId: toIdString(raw._id),
    conversationId: toIdString(raw.conversationId),
    callerId: toIdString(raw.callerId),
    receiverId: toIdString(raw.receiverId),
    initiatorId: toIdString(raw.initiatorId ?? raw.callerId),
    hostId: toIdString(raw.hostId ?? raw.callerId),
    callType: raw.callType ?? CALL_TYPES.VOICE,
    callMode: raw.callMode ?? CALL_MODES.DIRECT,
    status: raw.status,
    startedAt: raw.startedAt ?? null,
    acceptedAt: raw.acceptedAt ?? null,
    endedAt: raw.endedAt ?? null,
    durationSeconds: raw.durationSeconds ?? 0,
    endReason: raw.endReason ?? null,
    participants: (raw.participants ?? []).map((participant) => ({
      userId: toIdString(participant.userId),
      status: participant.status,
      invitedAt: participant.invitedAt ?? null,
      joinedAt: participant.joinedAt ?? null,
      leftAt: participant.leftAt ?? null,
      durationSeconds: participant.durationSeconds ?? 0,
    })),
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
};

const buildGroupCallState = (callSession) => {
  const payload = normalizeCallSession(callSession);
  return {
    ...payload,
    joinedParticipantIds: getJoinedParticipantIds(callSession),
    joinedCount: getJoinedParticipants(callSession).length,
    maxParticipants: MAX_GROUP_CALL_PARTICIPANTS,
  };
};

const getPeerId = (callSession, userId) => {
  const currentUserId = toIdString(userId);
  const callerId = toIdString(callSession.callerId);
  const receiverId = toIdString(callSession.receiverId);

  if (currentUserId === callerId) return receiverId;
  if (currentUserId === receiverId) return callerId;
  return "";
};

const emitCallError = (userId, error, extra = {}) => {
  emitToUser(userId, CALL_SOCKET_EVENTS.ERROR, { ...error, ...extra });
};

const emitCallBusy = (userId, payload) => {
  emitToUser(userId, CALL_SOCKET_EVENTS.BUSY, payload);
};

const markActive = (callSession) => {
  const callSessionId = toIdString(callSession._id);
  activeCallIds.add(callSessionId);
  activeCallsByUser.set(toIdString(callSession.callerId), callSessionId);
  if (callSession.receiverId) {
    activeCallsByUser.set(toIdString(callSession.receiverId), callSessionId);
  }
};

const clearRingingTimeout = (callSessionId) => {
  const timeout = timeoutByCallId.get(callSessionId);
  if (timeout) {
    clearTimeout(timeout);
    timeoutByCallId.delete(callSessionId);
  }
};

const clearGroupParticipantTimeout = (callSessionId, userId) => {
  const timeoutKey = `${callSessionId}:${toIdString(userId)}`;
  const timeouts = groupInviteTimeoutsByCallId.get(callSessionId);
  const timeout = timeouts?.get(timeoutKey);
  if (timeout) {
    clearTimeout(timeout);
    timeouts.delete(timeoutKey);
  }
  if (timeouts?.size === 0) {
    groupInviteTimeoutsByCallId.delete(callSessionId);
  }
};

const clearGroupParticipantTimeouts = (callSessionId) => {
  const timeouts = groupInviteTimeoutsByCallId.get(callSessionId);
  if (!timeouts) return;
  timeouts.forEach((timeout) => clearTimeout(timeout));
  groupInviteTimeoutsByCallId.delete(callSessionId);
};

const clearGroupEndGraceTimeout = (callSessionId) => {
  const timeout = groupEndGraceTimeoutByCallId.get(callSessionId);
  if (timeout) {
    clearTimeout(timeout);
    groupEndGraceTimeoutByCallId.delete(callSessionId);
  }
};

const cleanupActiveCall = (callSession) => {
  const callSessionId = toIdString(callSession._id);
  clearRingingTimeout(callSessionId);
  clearGroupParticipantTimeouts(callSessionId);
  clearGroupEndGraceTimeout(callSessionId);
  activeCallIds.delete(callSessionId);
  activeCallsByUser.delete(toIdString(callSession.callerId));
  if (callSession.receiverId) {
    activeCallsByUser.delete(toIdString(callSession.receiverId));
  }
  if (isGroupCall(callSession)) {
    activeGroupCallsByConversationId.delete(toIdString(callSession.conversationId));
    (callSession.participants ?? [])
      .map((participant) => toIdString(participant.userId))
      .forEach((userId) => {
        if (activeCallsByUser.get(userId) === callSessionId) {
          activeCallsByUser.delete(userId);
        }
      });
  }
};

const getActiveCallIdForUser = (userId) =>
  activeCallsByUser.get(toIdString(userId));

const isUserBusy = (userId) => Boolean(getActiveCallIdForUser(userId));

const calculateDurationSeconds = (callSession, endedAt) => {
  if (!callSession.acceptedAt) return 0;
  return Math.max(
    0,
    Math.floor(
      (endedAt.getTime() - new Date(callSession.acceptedAt).getTime()) / 1000,
    ),
  );
};

const calculateParticipantDurationSeconds = (participant, endedAt) => {
  if (!participant?.joinedAt) return participant?.durationSeconds ?? 0;
  return Math.max(
    0,
    Math.floor((endedAt.getTime() - new Date(participant.joinedAt).getTime()) / 1000),
  );
};

const formatCallDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remain = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
};

const getGroupCallHistoryContent = (callSession) => {
  if (
    callSession.status === CALL_STATUSES.MISSED ||
    callSession.endReason === CALL_END_REASONS.MISSED
  ) {
    return "Cuộc gọi thoại nhóm nhỡ";
  }
  if (callSession.status === CALL_STATUSES.CANCELLED) {
    return "Cuộc gọi thoại nhóm đã hủy";
  }
  if (callSession.status === CALL_STATUSES.ENDED) {
    return `Cuộc gọi thoại nhóm đã kết thúc (${formatCallDuration(callSession.durationSeconds)})`;
  }
  if (callSession.status === CALL_STATUSES.FAILED) {
    return "Cuộc gọi thoại nhóm thất bại";
  }
  return "Cuộc gọi thoại nhóm";
};

const getCallHistoryContent = (callSession) => {
  const label =
    (callSession.callType ?? CALL_TYPES.VOICE) === CALL_TYPES.VIDEO
      ? "Cuộc gọi video"
      : "Cuộc gọi thoại";

  switch (callSession.status) {
    case CALL_STATUSES.REJECTED:
      return `${label} bị từ chối`;
    case CALL_STATUSES.MISSED:
      return `${label} nhỡ`;
    case CALL_STATUSES.CANCELLED:
      return `${label} đã hủy`;
    case CALL_STATUSES.ENDED:
      return `${label} đã kết thúc (${formatCallDuration(callSession.durationSeconds)})`;
    case CALL_STATUSES.FAILED:
      return `${label} thất bại`;
    default:
      return label;
  }
};

const createCallHistoryMessage = async (callSession) => {
  if (!terminalStatuses.has(callSession.status)) return null;

  const conversation = await Conversation.findById(callSession.conversationId);
  if (!conversation) return null;

  const callMode = callSession.callMode ?? CALL_MODES.DIRECT;
  if (callMode === CALL_MODES.DIRECT && conversation.type !== "direct") return null;
  if (callMode === CALL_MODES.GROUP && conversation.type !== "group") return null;

  const participantCount =
    callMode === CALL_MODES.GROUP
      ? (callSession.participants ?? []).filter((participant) =>
          [CALL_PARTICIPANT_STATUS.JOINED, CALL_PARTICIPANT_STATUS.LEFT].includes(
            participant.status,
          ),
        ).length
      : 2;

  const message = await Message.create({
    conversationId: conversation._id,
    senderId: null,
    senderDeleted: false,
    type: "system",
    content:
      callMode === CALL_MODES.GROUP
        ? getGroupCallHistoryContent(callSession)
        : getCallHistoryContent(callSession),
    callMetadata: {
      callSessionId: callSession._id,
      callType: callSession.callType ?? CALL_TYPES.VOICE,
      callMode,
      callStatus: callSession.status,
      callDurationSeconds: callSession.durationSeconds ?? 0,
      durationSeconds: callSession.durationSeconds ?? 0,
      participantCount,
      initiatorId: callSession.initiatorId ?? callSession.callerId,
      callerId: callSession.callerId,
      receiverId: callSession.receiverId ?? null,
    },
  });

  updateConversationAfterCreateMessage(conversation, message, callSession.callerId, {
    isConversationActive: () => true,
  });
  conversation.participants.forEach((participant) => {
    conversation.unreadCounts.set(participant.userId.toString(), 0);
  });
  conversation.seenBy = conversation.participants.map(
    (participant) => participant.userId,
  );
  await conversation.save();

  emitNewMessage(getIo(), conversation, message);
  return message;
};

const loadDirectConversationForInvite = async ({
  conversationId,
  callerId,
  receiverId,
}) => {
  if (![conversationId, callerId].every(isValidId)) {
    return {
      error: buildError(CALL_ERROR_CODES.FORBIDDEN, "Dữ liệu cuộc gọi không hợp lệ"),
    };
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return {
      error: buildError(
        CALL_ERROR_CODES.CONVERSATION_NOT_FOUND,
        "Không tìm thấy cuộc trò chuyện",
      ),
    };
  }

  if (conversation.type !== "direct" || conversation.participants.length !== 2) {
    return {
      error: buildError(
        CALL_ERROR_CODES.NOT_DIRECT_CONVERSATION,
        "Chỉ hỗ trợ gọi thoại trong cuộc trò chuyện 1-1",
      ),
    };
  }

  const memberIds = conversation.participants.map((participant) =>
    toIdString(participant.userId),
  );
  const normalizedCallerId = toIdString(callerId);
  const normalizedReceiverId = receiverId ? toIdString(receiverId) : null;
  const expectedReceiverId = memberIds.find(
    (memberId) => memberId !== normalizedCallerId,
  );

  if (!memberIds.includes(normalizedCallerId)) {
    return {
      error: buildError(
        CALL_ERROR_CODES.FORBIDDEN,
        "Bạn không thuộc cuộc trò chuyện này",
      ),
    };
  }

  if (
    !expectedReceiverId ||
    (normalizedReceiverId && normalizedReceiverId !== expectedReceiverId)
  ) {
    return {
      error: buildError(CALL_ERROR_CODES.FORBIDDEN, "Người nhận không hợp lệ"),
    };
  }

  if (normalizedCallerId === (normalizedReceiverId ?? expectedReceiverId)) {
    return {
      error: buildError(CALL_ERROR_CODES.FORBIDDEN, "Không thể tự gọi chính mình"),
    };
  }

  return { conversation, receiverId: expectedReceiverId };
};

const validateDirectBlock = async ({ callerId, receiverId }) => {
  if (![callerId, receiverId].every(isValidId)) {
    return {
      error: buildError(CALL_ERROR_CODES.FORBIDDEN, "Người dùng không hợp lệ"),
    };
  }

  const [callerUser, receiverUser] = await Promise.all([
    User.findById(callerId).select("blockedUsers"),
    User.findById(receiverId).select("blockedUsers"),
  ]);

  if (!callerUser || !receiverUser) {
    return {
      error: buildError(CALL_ERROR_CODES.FORBIDDEN, "Người dùng không hợp lệ"),
    };
  }

  const directPermission = ensureDirectMessagingAllowed({
    senderUser: callerUser,
    recipientUser: receiverUser,
    senderId: callerId,
    recipientId: receiverId,
  });

  if (!directPermission.allowed) {
    return {
      error: buildError(
        CALL_ERROR_CODES.BLOCKED,
        "Không thể gọi do một trong hai bên đã chặn bên còn lại",
      ),
    };
  }

  return {};
};

const loadActiveCallForUser = async ({ callSessionId, userId }) => {
  const activeCallId = getActiveCallIdForUser(userId);
  const resolvedCallId = callSessionId ?? activeCallId;

  if (
    !resolvedCallId ||
    !isValidId(resolvedCallId) ||
    (callSessionId && activeCallId !== callSessionId)
  ) {
    return {
      error: buildError(
        CALL_ERROR_CODES.NOT_FOUND,
        "Không tìm thấy cuộc gọi đang hoạt động",
      ),
    };
  }

  const callSession = await CallSession.findById(resolvedCallId);
  if (!callSession || !activeCallIds.has(toIdString(callSession._id))) {
    return {
      error: buildError(
        CALL_ERROR_CODES.NOT_FOUND,
        "Không tìm thấy cuộc gọi đang hoạt động",
      ),
    };
  }

  const userIsParticipant = [callSession.callerId, callSession.receiverId]
    .map(toIdString)
    .includes(toIdString(userId));

  if (!userIsParticipant) {
    return {
      error: buildError(CALL_ERROR_CODES.FORBIDDEN, "Bạn không thuộc cuộc gọi này"),
    };
  }

  return { callSession };
};

const completeCall = async ({ callSession, status, endReason, eventName }) => {
  const endedAt = new Date();
  callSession.status = status;
  callSession.endedAt = endedAt;
  callSession.endReason = endReason;
  callSession.durationSeconds =
    status === CALL_STATUSES.ENDED ? calculateDurationSeconds(callSession, endedAt) : 0;

  try {
    await callSession.save();
  } finally {
    cleanupActiveCall(callSession);
  }

  try {
    await createCallHistoryMessage(callSession);
  } catch (error) {
    console.error("Không thể tạo lịch sử cuộc gọi:", error);
  }

  const payload = normalizeCallSession(callSession);
  if (eventName) {
    emitToUser(toIdString(callSession.callerId), eventName, payload);
    emitToUser(toIdString(callSession.receiverId), eventName, payload);
  }

  return payload;
};

const scheduleMissedTimeout = (callSessionId) => {
  clearRingingTimeout(callSessionId);
  const timeout = setTimeout(async () => {
    try {
      const callSession = await CallSession.findById(callSessionId);
      if (!callSession || callSession.status !== CALL_STATUSES.RINGING) return;

      await completeCall({
        callSession,
        status: CALL_STATUSES.MISSED,
        endReason: CALL_END_REASONS.MISSED,
        eventName: CALL_SOCKET_EVENTS.MISSED,
      });
    } catch (error) {
      console.error("Cannot process call timeout:", error);
    }
  }, CALL_RING_TIMEOUT_MS);

  timeoutByCallId.set(callSessionId, timeout);
};

const emitGroupCallError = (userId, error, extra = {}) => {
  emitToUser(userId, CALL_SOCKET_EVENTS.GROUP_ERROR, { ...error, ...extra });
};

const emitGroupCallBusy = (userId, payload) => {
  emitToUser(userId, CALL_SOCKET_EVENTS.GROUP_BUSY, payload);
};

const emitToGroupConversationParticipants = (conversation, eventName, payload) => {
  conversation.participants.forEach((participant) => {
    emitToUser(toIdString(participant.userId), eventName, payload);
  });
};

const emitToJoinedGroupParticipants = (callSession, eventName, payload) => {
  getJoinedParticipantIds(callSession).forEach((userId) => {
    emitToUser(userId, eventName, payload);
  });
};

const loadGroupConversation = async ({ conversationId, userId }) => {
  if (![conversationId, userId].every(isValidId)) {
    return {
      error: buildError(CALL_ERROR_CODES.GROUP_FORBIDDEN, "Dữ liệu cuộc gọi nhóm không hợp lệ"),
    };
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return {
      error: buildError(
        CALL_ERROR_CODES.GROUP_NOT_FOUND,
        "Không tìm thấy cuộc trò chuyện nhóm",
      ),
    };
  }

  if (conversation.type !== "group") {
    return {
      error: buildError(
        CALL_ERROR_CODES.GROUP_NOT_GROUP_CONVERSATION,
        "Chỉ hỗ trợ gọi thoại nhóm trong cuộc trò chuyện nhóm",
      ),
    };
  }

  if (!userBelongsToConversation(conversation, userId)) {
    return {
      error: buildError(
        CALL_ERROR_CODES.GROUP_NOT_PARTICIPANT,
        "Bạn không thuộc nhóm trò chuyện này",
      ),
    };
  }

  return { conversation };
};

const loadGroupCall = async ({ callSessionId, userId, requireJoined = false }) => {
  if (!isValidId(callSessionId) || !isValidId(userId)) {
    return {
      error: buildError(CALL_ERROR_CODES.GROUP_NOT_FOUND, "Không tìm thấy cuộc gọi nhóm"),
    };
  }

  const callSession = await CallSession.findById(callSessionId);
  if (
    !callSession ||
    !isGroupCall(callSession) ||
    callSession.callType !== CALL_TYPES.VOICE
  ) {
    return {
      error: buildError(CALL_ERROR_CODES.GROUP_NOT_FOUND, "Không tìm thấy cuộc gọi thoại nhóm"),
    };
  }

  if (!groupLiveStatuses.has(callSession.status)) {
    return {
      error: buildError(
        CALL_ERROR_CODES.GROUP_INVALID_STATE,
        "Cuộc gọi nhóm không còn hoạt động",
      ),
    };
  }

  const participant = getParticipant(callSession, userId);
  if (!participant) {
    return {
      error: buildError(
        CALL_ERROR_CODES.GROUP_NOT_PARTICIPANT,
        "Bạn không thuộc cuộc gọi nhóm này",
      ),
    };
  }

  if (requireJoined && participant.status !== CALL_PARTICIPANT_STATUS.JOINED) {
    return {
      error: buildError(
        CALL_ERROR_CODES.GROUP_SIGNALING_FORBIDDEN,
        "Bạn chưa tham gia cuộc gọi nhóm này",
      ),
    };
  }

  const conversation = await Conversation.findById(callSession.conversationId);
  if (!conversation || !userBelongsToConversation(conversation, userId)) {
    return {
      error: buildError(
        CALL_ERROR_CODES.GROUP_NOT_PARTICIPANT,
        "Bạn không thuộc nhóm trò chuyện này",
      ),
    };
  }

  return { callSession, conversation, participant };
};

const updateGroupCallStatusAfterJoin = (callSession) => {
  const joinedCount = getJoinedParticipants(callSession).length;
  if (joinedCount >= 2 && callSession.status !== CALL_STATUSES.ACTIVE) {
    callSession.status = CALL_STATUSES.ACTIVE;
    callSession.acceptedAt = callSession.acceptedAt ?? new Date();
    return true;
  }
  return false;
};

const endGroupCall = async ({
  callSession,
  conversation,
  endReason = CALL_END_REASONS.ENDED_BY_USER,
  status = CALL_STATUSES.ENDED,
}) => {
  const endedAt = new Date();
  const joinedCount = getJoinedParticipants(callSession).length;
  callSession.status = status;
  callSession.endedAt = endedAt;
  callSession.endReason = endReason;
  callSession.durationSeconds =
    callSession.acceptedAt && status === CALL_STATUSES.ENDED
      ? calculateDurationSeconds(callSession, endedAt)
      : 0;

  (callSession.participants ?? []).forEach((participant) => {
    if (participant.status === CALL_PARTICIPANT_STATUS.JOINED) {
      participant.status = CALL_PARTICIPANT_STATUS.LEFT;
      participant.leftAt = participant.leftAt ?? endedAt;
      participant.durationSeconds = calculateParticipantDurationSeconds(participant, endedAt);
    }
  });

  try {
    await callSession.save();
  } finally {
    cleanupActiveCall(callSession);
  }

  try {
    await createCallHistoryMessage(callSession);
  } catch (error) {
    console.error("Không thể tạo lịch sử cuộc gọi nhóm:", error);
  }

  const payload = {
    ...buildGroupCallState(callSession),
    participantCount: joinedCount,
  };
  emitToGroupConversationParticipants(conversation, CALL_SOCKET_EVENTS.GROUP_ENDED, payload);
  return payload;
};

const scheduleGroupEndIfNeeded = ({ callSession, conversation }) => {
  const callSessionId = toIdString(callSession._id);
  clearGroupEndGraceTimeout(callSessionId);

  if (callSession.status !== CALL_STATUSES.ACTIVE) return;
  if (getJoinedParticipants(callSession).length >= 2) return;

  const timeout = setTimeout(async () => {
    try {
      const freshCallSession = await CallSession.findById(callSessionId);
      if (
        !freshCallSession ||
        !isGroupCall(freshCallSession) ||
        !groupLiveStatuses.has(freshCallSession.status) ||
        getJoinedParticipants(freshCallSession).length >= 2
      ) {
        return;
      }

      await endGroupCall({
        callSession: freshCallSession,
        conversation,
        endReason: CALL_END_REASONS.ENDED_BY_USER,
      });
    } catch (error) {
      console.error("Cannot end group call after grace:", error);
    }
  }, GROUP_CALL_END_GRACE_MS);

  groupEndGraceTimeoutByCallId.set(callSessionId, timeout);
};

const maybeEndUnansweredGroupCall = async ({ callSession, conversation }) => {
  if (callSession.status !== CALL_STATUSES.RINGING) return null;

  const hasPendingInvite = (callSession.participants ?? []).some((participant) =>
    [CALL_PARTICIPANT_STATUS.INVITED, CALL_PARTICIPANT_STATUS.RINGING].includes(
      participant.status,
    ),
  );
  const joinedCount = getJoinedParticipants(callSession).length;

  if (hasPendingInvite || joinedCount >= 2) return null;

  return endGroupCall({
    callSession,
    conversation,
    endReason: CALL_END_REASONS.MISSED,
  });
};

const scheduleGroupParticipantMissed = ({ callSessionId, userId }) => {
  clearGroupParticipantTimeout(callSessionId, userId);

  const timeoutKey = `${callSessionId}:${toIdString(userId)}`;
  const timeout = setTimeout(async () => {
    try {
      const callSession = await CallSession.findById(callSessionId);
      if (!callSession || !isGroupCall(callSession) || !groupLiveStatuses.has(callSession.status)) {
        return;
      }

      const participant = getParticipant(callSession, userId);
      if (
        !participant ||
        ![CALL_PARTICIPANT_STATUS.INVITED, CALL_PARTICIPANT_STATUS.RINGING].includes(
          participant.status,
        )
      ) {
        return;
      }

      participant.status = CALL_PARTICIPANT_STATUS.MISSED;
      await callSession.save();
      clearGroupParticipantTimeout(callSessionId, userId);

      const conversation = await Conversation.findById(callSession.conversationId);
      const payload = {
        callId: callSessionId,
        callSessionId,
        conversationId: toIdString(callSession.conversationId),
        userId: toIdString(userId),
        state: buildGroupCallState(callSession),
      };
      emitToJoinedGroupParticipants(
        callSession,
        CALL_SOCKET_EVENTS.GROUP_PARTICIPANT_MISSED,
        payload,
      );

      if (conversation) {
        await maybeEndUnansweredGroupCall({ callSession, conversation });
      }
    } catch (error) {
      console.error("Cannot process group call participant timeout:", error);
    }
  }, GROUP_CALL_INVITE_TIMEOUT_MS);

  const timeouts = groupInviteTimeoutsByCallId.get(callSessionId) ?? new Map();
  timeouts.set(timeoutKey, timeout);
  groupInviteTimeoutsByCallId.set(callSessionId, timeouts);
};

export const startGroupVoiceCall = async ({ userId, conversationId, callType }) => {
  const resolvedCallType = normalizeCallType(callType);
  if (resolvedCallType === CALL_TYPES.VIDEO) {
    return {
      error: buildError(
        CALL_ERROR_CODES.GROUP_VIDEO_NOT_SUPPORTED,
        "MVP chưa hỗ trợ gọi video nhóm",
      ),
    };
  }
  if (resolvedCallType !== CALL_TYPES.VOICE) {
    return {
      error: buildError(CALL_ERROR_CODES.INVALID_TYPE, "Loại cuộc gọi không hợp lệ"),
    };
  }

  const context = await loadGroupConversation({ conversationId, userId });
  if (context.error) return { error: context.error };

  const caller = await User.findById(userId).select("displayName userName avatarUrl status");
  if (!caller || caller.status !== "active") {
    return {
      error: buildError(
        CALL_ERROR_CODES.GROUP_FORBIDDEN,
        "Tài khoản không được phép bắt đầu cuộc gọi nhóm",
      ),
    };
  }

  if (isUserBusy(userId)) {
    return {
      error: buildError(CALL_ERROR_CODES.GROUP_USER_BUSY, "Bạn đang trong cuộc gọi khác"),
    };
  }

  const normalizedConversationId = toIdString(conversationId);
  if (activeGroupCallsByConversationId.has(normalizedConversationId)) {
    return {
      error: buildError(
        CALL_ERROR_CODES.GROUP_ALREADY_ACTIVE,
        "Nhóm đang có cuộc gọi khác",
      ),
    };
  }

  const existingLiveCall = await CallSession.findOne?.({
    conversationId,
    callMode: CALL_MODES.GROUP,
    status: { $in: Array.from(groupLiveStatuses) },
  });
  if (existingLiveCall) {
    activeGroupCallsByConversationId.set(normalizedConversationId, toIdString(existingLiveCall._id));
    return {
      error: buildError(
        CALL_ERROR_CODES.GROUP_ALREADY_ACTIVE,
        "Nhóm đang có cuộc gọi khác",
      ),
    };
  }

  const now = new Date();
  const participants = context.conversation.participants.map((participant) => {
    const participantId = toIdString(participant.userId);
    const isCaller = participantId === toIdString(userId);
    return {
      userId: participant.userId,
      status: isCaller
        ? CALL_PARTICIPANT_STATUS.JOINED
        : CALL_PARTICIPANT_STATUS.RINGING,
      invitedAt: now,
      joinedAt: isCaller ? now : null,
      leftAt: null,
      durationSeconds: 0,
    };
  });

  const callSession = await CallSession.create({
    conversationId,
    callerId: userId,
    initiatorId: userId,
    hostId: userId,
    callType: CALL_TYPES.VOICE,
    callMode: CALL_MODES.GROUP,
    status: CALL_STATUSES.RINGING,
    startedAt: now,
    participants,
  });

  markActive(callSession);
  activeGroupCallsByConversationId.set(normalizedConversationId, toIdString(callSession._id));

  const callSessionId = toIdString(callSession._id);
  participants
    .filter((participant) => toIdString(participant.userId) !== toIdString(userId))
    .forEach((participant) => {
      const participantId = toIdString(participant.userId);
      scheduleGroupParticipantMissed({ callSessionId, userId: participantId });
      emitToUser(participantId, CALL_SOCKET_EVENTS.GROUP_INCOMING, {
        callId: callSessionId,
        callSessionId,
        conversationId: normalizedConversationId,
        groupName: context.conversation.group?.name ?? "Nhóm",
        caller: {
          _id: toIdString(caller._id),
          displayName: caller.displayName,
          userName: caller.userName,
          avatarUrl: caller.avatarUrl ?? null,
        },
        callType: CALL_TYPES.VOICE,
        callMode: CALL_MODES.GROUP,
      });
    });

  const payload = buildGroupCallState(callSession);
  emitToUser(userId, CALL_SOCKET_EVENTS.GROUP_STARTED, payload);

  return { payload: { ...payload, roomId: getCallRoomId(callSessionId) } };
};

export const joinGroupVoiceCall = async ({ userId, callSessionId }) => {
  const { callSession, participant, error } = await loadGroupCall({
    callSessionId,
    userId,
  });
  if (error) return { error };

  const activeCallId = getActiveCallIdForUser(userId);
  if (activeCallId && activeCallId !== toIdString(callSession._id)) {
    return {
      error: buildError(CALL_ERROR_CODES.GROUP_USER_BUSY, "Bạn đang trong cuộc gọi khác"),
    };
  }

  const alreadyJoined = participant.status === CALL_PARTICIPANT_STATUS.JOINED;
  if (!alreadyJoined && getJoinedParticipants(callSession).length >= MAX_GROUP_CALL_PARTICIPANTS) {
    return {
      error: buildError(
        CALL_ERROR_CODES.GROUP_PARTICIPANT_LIMIT_REACHED,
        "Cuộc gọi nhóm đã đạt giới hạn người tham gia",
      ),
    };
  }

  if (!alreadyJoined) {
    participant.status = CALL_PARTICIPANT_STATUS.JOINED;
    participant.joinedAt = new Date();
    participant.leftAt = null;
    clearGroupParticipantTimeout(toIdString(callSession._id), userId);
  }

  activeCallsByUser.set(toIdString(userId), toIdString(callSession._id));
  const becameActive = updateGroupCallStatusAfterJoin(callSession);
  clearGroupEndGraceTimeout(toIdString(callSession._id));
  await callSession.save();

  const state = buildGroupCallState(callSession);
  const payload = {
    callId: toIdString(callSession._id),
    callSessionId: toIdString(callSession._id),
    conversationId: toIdString(callSession.conversationId),
    userId: toIdString(userId),
    state,
  };

  emitToJoinedGroupParticipants(
    callSession,
    CALL_SOCKET_EVENTS.GROUP_PARTICIPANT_JOINED,
    payload,
  );
  if (becameActive) {
    emitToJoinedGroupParticipants(callSession, CALL_SOCKET_EVENTS.GROUP_STARTED, state);
  }

  return { payload: { ...state, roomId: getCallRoomId(callSession._id) } };
};

export const declineGroupVoiceCall = async ({ userId, callSessionId }) => {
  const { callSession, conversation, participant, error } = await loadGroupCall({
    callSessionId,
    userId,
  });
  if (error) return { error };

  if (
    ![CALL_PARTICIPANT_STATUS.INVITED, CALL_PARTICIPANT_STATUS.RINGING].includes(
      participant.status,
    )
  ) {
    return {
      error: buildError(
        CALL_ERROR_CODES.GROUP_INVALID_STATE,
        "Không thể từ chối cuộc gọi ở trạng thái hiện tại",
      ),
    };
  }

  participant.status = CALL_PARTICIPANT_STATUS.DECLINED;
  clearGroupParticipantTimeout(toIdString(callSession._id), userId);
  await callSession.save();

  const payload = {
    callId: toIdString(callSession._id),
    callSessionId: toIdString(callSession._id),
    conversationId: toIdString(callSession.conversationId),
    userId: toIdString(userId),
    state: buildGroupCallState(callSession),
  };
  emitToJoinedGroupParticipants(
    callSession,
    CALL_SOCKET_EVENTS.GROUP_PARTICIPANT_DECLINED,
    payload,
  );

  await maybeEndUnansweredGroupCall({ callSession, conversation });
  return { payload };
};

export const leaveGroupVoiceCall = async ({ userId, callSessionId }) => {
  const { callSession, conversation, participant, error } = await loadGroupCall({
    callSessionId,
    userId,
    requireJoined: true,
  });
  if (error) return { error };

  const leftAt = new Date();
  participant.status = CALL_PARTICIPANT_STATUS.LEFT;
  participant.leftAt = leftAt;
  participant.durationSeconds = calculateParticipantDurationSeconds(participant, leftAt);
  activeCallsByUser.delete(toIdString(userId));
  clearGroupParticipantTimeout(toIdString(callSession._id), userId);
  await callSession.save();

  const payload = {
    callId: toIdString(callSession._id),
    callSessionId: toIdString(callSession._id),
    conversationId: toIdString(callSession.conversationId),
    userId: toIdString(userId),
    state: buildGroupCallState(callSession),
  };
  emitToJoinedGroupParticipants(
    callSession,
    CALL_SOCKET_EVENTS.GROUP_PARTICIPANT_LEFT,
    payload,
  );
  emitToUser(userId, CALL_SOCKET_EVENTS.GROUP_PARTICIPANT_LEFT, payload);

  scheduleGroupEndIfNeeded({ callSession, conversation });
  await maybeEndUnansweredGroupCall({ callSession, conversation });

  return { payload };
};

export const endGroupVoiceCall = async ({ userId, callSessionId }) => {
  const { callSession, conversation, error } = await loadGroupCall({
    callSessionId,
    userId,
    requireJoined: true,
  });
  if (error) return { error };

  if (toIdString(callSession.hostId ?? callSession.callerId) !== toIdString(userId)) {
    return {
      error: buildError(
        CALL_ERROR_CODES.GROUP_FORBIDDEN,
        "Chỉ host mới có thể kết thúc toàn bộ cuộc gọi nhóm",
      ),
    };
  }

  const payload = await endGroupCall({
    callSession,
    conversation,
    endReason: CALL_END_REASONS.ENDED_BY_USER,
  });
  return { payload };
};

export const syncGroupVoiceCallState = async ({ userId, callSessionId }) => {
  const { callSession, error } = await loadGroupCall({
    callSessionId,
    userId,
  });
  if (error) return { error };

  return { payload: buildGroupCallState(callSession) };
};

export const relayGroupCallSignal = async ({
  userId,
  callSessionId,
  targetUserId,
  eventName,
  signalPayload,
}) => {
  const { callSession, error } = await loadGroupCall({
    callSessionId,
    userId,
    requireJoined: true,
  });
  if (error) {
    return {
      error: buildError(CALL_ERROR_CODES.GROUP_SIGNALING_FORBIDDEN, error.message),
    };
  }

  const targetParticipant = getParticipant(callSession, targetUserId);
  if (!targetParticipant || targetParticipant.status !== CALL_PARTICIPANT_STATUS.JOINED) {
    return {
      error: buildError(
        CALL_ERROR_CODES.GROUP_SIGNALING_FORBIDDEN,
        "Người nhận tín hiệu không thuộc cuộc gọi nhóm",
      ),
    };
  }

  const eventPayload = {
    callId: toIdString(callSession._id),
    callSessionId: toIdString(callSession._id),
    conversationId: toIdString(callSession.conversationId),
    fromUserId: toIdString(userId),
  };

  if (eventName === CALL_SOCKET_EVENTS.GROUP_OFFER) {
    eventPayload.offer = signalPayload;
  } else if (eventName === CALL_SOCKET_EVENTS.GROUP_ANSWER) {
    eventPayload.answer = signalPayload;
  } else {
    eventPayload.candidate = signalPayload;
  }

  emitToUser(targetUserId, eventName, eventPayload);
  return { payload: { relayed: true } };
};

export const inviteCall = async ({
  callerId,
  conversationId,
  receiverId,
  callType,
}) => {
  const resolvedCallType = normalizeCallType(callType);
  if (!isValidCallType(resolvedCallType)) {
    return {
      error: buildError(
        CALL_ERROR_CODES.INVALID_TYPE,
        "Loại cuộc gọi không hợp lệ",
      ),
    };
  }

  const context = await loadDirectConversationForInvite({
    conversationId,
    callerId,
    receiverId,
  });
  if (context.error) return { error: context.error };

  const resolvedReceiverId = context.receiverId;
  const blockValidation = await validateDirectBlock({
    callerId,
    receiverId: resolvedReceiverId,
  });
  if (blockValidation.error) return { error: blockValidation.error };

  if (!isUserOnline(resolvedReceiverId)) {
    return {
      error: buildError(CALL_ERROR_CODES.RECEIVER_OFFLINE, "Người nhận đang ngoại tuyến"),
    };
  }

  if (isUserBusy(callerId) || isUserBusy(resolvedReceiverId)) {
    return {
      error: buildError(
        CALL_ERROR_CODES.USER_BUSY,
        "Một trong hai người đang trong cuộc gọi khác",
      ),
    };
  }

  const callSession = await CallSession.create({
    conversationId,
    callerId,
    receiverId: resolvedReceiverId,
    initiatorId: callerId,
    hostId: callerId,
    callType: resolvedCallType,
    callMode: CALL_MODES.DIRECT,
    status: CALL_STATUSES.RINGING,
    startedAt: new Date(),
  });

  markActive(callSession);
  scheduleMissedTimeout(toIdString(callSession._id));

  const payload = normalizeCallSession(callSession);
  emitToUser(resolvedReceiverId, CALL_SOCKET_EVENTS.INCOMING, payload);

  return { payload };
};

export const acceptCall = async ({ userId, callSessionId }) => {
  const { callSession, error } = await loadActiveCallForUser({
    callSessionId,
    userId,
  });
  if (error) return { error };

  if (toIdString(callSession.receiverId) !== toIdString(userId)) {
    return {
      error: buildError(
        CALL_ERROR_CODES.FORBIDDEN,
        "Chỉ người nhận mới có thể chấp nhận cuộc gọi",
      ),
    };
  }

  if (callSession.status !== CALL_STATUSES.RINGING) {
    return {
      error: buildError(
        CALL_ERROR_CODES.INVALID_STATE,
        "Cuộc gọi không còn ở trạng thái chờ",
      ),
    };
  }

  clearRingingTimeout(toIdString(callSession._id));
  callSession.status = CALL_STATUSES.ACCEPTED;
  callSession.acceptedAt = new Date();
  await callSession.save();

  const payload = normalizeCallSession(callSession);
  emitToUser(toIdString(callSession.callerId), CALL_SOCKET_EVENTS.ACCEPTED, payload);
  return { payload };
};

export const rejectCall = async ({ userId, callSessionId }) => {
  const { callSession, error } = await loadActiveCallForUser({
    callSessionId,
    userId,
  });
  if (error) return { error };

  if (toIdString(callSession.receiverId) !== toIdString(userId)) {
    return {
      error: buildError(
        CALL_ERROR_CODES.FORBIDDEN,
        "Chỉ người nhận mới có thể từ chối cuộc gọi",
      ),
    };
  }

  if (callSession.status !== CALL_STATUSES.RINGING) {
    return {
      error: buildError(
        CALL_ERROR_CODES.INVALID_STATE,
        "Cuộc gọi không còn ở trạng thái chờ",
      ),
    };
  }

  const payload = await completeCall({
    callSession,
    status: CALL_STATUSES.REJECTED,
    endReason: CALL_END_REASONS.REJECTED,
    eventName: CALL_SOCKET_EVENTS.REJECTED,
  });

  return { payload };
};

export const cancelCall = async ({ userId, callSessionId }) => {
  const { callSession, error } = await loadActiveCallForUser({
    callSessionId,
    userId,
  });
  if (error) return { error };

  if (toIdString(callSession.callerId) !== toIdString(userId)) {
    return {
      error: buildError(
        CALL_ERROR_CODES.FORBIDDEN,
        "Chỉ người gọi mới có thể hủy cuộc gọi",
      ),
    };
  }

  if (callSession.status !== CALL_STATUSES.RINGING) {
    return {
      error: buildError(
        CALL_ERROR_CODES.INVALID_STATE,
        "Chỉ có thể hủy cuộc gọi đang chờ",
      ),
    };
  }

  const payload = await completeCall({
    callSession,
    status: CALL_STATUSES.CANCELLED,
    endReason: CALL_END_REASONS.CANCELLED,
    eventName: CALL_SOCKET_EVENTS.CANCELLED,
  });

  return { payload };
};

export const endCall = async ({
  userId,
  callSessionId,
  endReason = CALL_END_REASONS.ENDED_BY_USER,
}) => {
  const { callSession, error } = await loadActiveCallForUser({
    callSessionId,
    userId,
  });
  if (error) return { error };

  if (callSession.status !== CALL_STATUSES.ACCEPTED) {
    return {
      error: buildError(
        CALL_ERROR_CODES.INVALID_STATE,
        "Chỉ có thể kết thúc cuộc gọi đã được chấp nhận",
      ),
    };
  }

  const payload = await completeCall({
    callSession,
    status: CALL_STATUSES.ENDED,
    endReason,
    eventName: CALL_SOCKET_EVENTS.ENDED,
  });

  return { payload };
};

export const relayCallSignal = async ({
  userId,
  callSessionId,
  eventName,
  signalPayload,
}) => {
  const { callSession, error } = await loadActiveCallForUser({
    callSessionId,
    userId,
  });
  if (error) {
    return { error: buildError(CALL_ERROR_CODES.SIGNALING_FORBIDDEN, error.message) };
  }

  if (![CALL_STATUSES.RINGING, CALL_STATUSES.ACCEPTED].includes(callSession.status)) {
    return {
      error: buildError(
        CALL_ERROR_CODES.INVALID_STATE,
        "Cuộc gọi không còn nhận tín hiệu",
      ),
    };
  }

  const callerId = toIdString(callSession.callerId);
  const receiverId = toIdString(callSession.receiverId);
  const senderId = toIdString(userId);

  if (eventName === CALL_SOCKET_EVENTS.OFFER && senderId !== callerId) {
    return {
      error: buildError(
        CALL_ERROR_CODES.SIGNALING_FORBIDDEN,
        "Offer chỉ được gửi từ người gọi",
      ),
    };
  }

  if (eventName === CALL_SOCKET_EVENTS.ANSWER && senderId !== receiverId) {
    return {
      error: buildError(
        CALL_ERROR_CODES.SIGNALING_FORBIDDEN,
        "Answer chỉ được gửi từ người nhận",
      ),
    };
  }

  const peerId = getPeerId(callSession, userId);
  if (!peerId) {
    return {
      error: buildError(
        CALL_ERROR_CODES.SIGNALING_FORBIDDEN,
        "Không xác định được người nhận tín hiệu",
      ),
    };
  }

  emitToUser(peerId, eventName, {
    callSessionId: toIdString(callSession._id),
    conversationId: toIdString(callSession.conversationId),
    fromUserId: senderId,
    payload: signalPayload ?? null,
  });

  return { payload: { relayed: true } };
};

export const handleUserDisconnectedFromCalls = async (userId) => {
  const callSessionId = getActiveCallIdForUser(userId);
  if (!callSessionId) return null;

  const callSession = await CallSession.findById(callSessionId);
  if (!callSession) {
    activeCallsByUser.delete(toIdString(userId));
    activeCallIds.delete(callSessionId);
    clearRingingTimeout(callSessionId);
    clearGroupParticipantTimeouts(callSessionId);
    clearGroupEndGraceTimeout(callSessionId);
    return null;
  }

  if (isGroupCall(callSession)) {
    const participant = getParticipant(callSession, userId);
    if (!participant || participant.status !== CALL_PARTICIPANT_STATUS.JOINED) {
      activeCallsByUser.delete(toIdString(userId));
      return null;
    }

    const conversation = await Conversation.findById(callSession.conversationId);
    if (!conversation) {
      activeCallsByUser.delete(toIdString(userId));
      return null;
    }

    const result = await leaveGroupVoiceCall({ userId, callSessionId });
    return result.payload ?? null;
  }

  if (callSession.status === CALL_STATUSES.RINGING) {
    const isCaller = toIdString(callSession.callerId) === toIdString(userId);
    return completeCall({
      callSession,
      status: isCaller ? CALL_STATUSES.CANCELLED : CALL_STATUSES.MISSED,
      endReason: CALL_END_REASONS.DISCONNECTED,
      eventName: isCaller ? CALL_SOCKET_EVENTS.CANCELLED : CALL_SOCKET_EVENTS.MISSED,
    });
  }

  if (callSession.status === CALL_STATUSES.ACCEPTED) {
    return completeCall({
      callSession,
      status: CALL_STATUSES.ENDED,
      endReason: CALL_END_REASONS.DISCONNECTED,
      eventName: CALL_SOCKET_EVENTS.ENDED,
    });
  }

  cleanupActiveCall(callSession);
  return null;
};

export const emitResultErrorToUser = ({ userId, error, callSessionId }) => {
  if (error.code?.startsWith("GROUP_CALL_")) {
    if (error.code === CALL_ERROR_CODES.GROUP_USER_BUSY) {
      emitGroupCallBusy(userId, { ...error, callSessionId: callSessionId ?? null });
      return;
    }

    emitGroupCallError(userId, error, { callSessionId: callSessionId ?? null });
    return;
  }

  if (error.code === CALL_ERROR_CODES.USER_BUSY) {
    emitCallBusy(userId, { ...error, callSessionId: callSessionId ?? null });
    return;
  }

  emitCallError(userId, error, { callSessionId: callSessionId ?? null });
};
