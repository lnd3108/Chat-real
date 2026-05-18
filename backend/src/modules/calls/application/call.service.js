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
  CALL_RING_TIMEOUT_MS,
  CALL_STATUSES,
  CALL_TYPES,
} from "../domain/call.constants.js";

const activeCallsByUser = new Map();
const activeCallIds = new Set();
const timeoutByCallId = new Map();

const terminalStatuses = new Set([
  CALL_STATUSES.REJECTED,
  CALL_STATUSES.MISSED,
  CALL_STATUSES.CANCELLED,
  CALL_STATUSES.ENDED,
  CALL_STATUSES.FAILED,
]);

const toIdString = (value) => {
  if (!value) return "";
  return value.toString ? value.toString() : String(value);
};

const buildError = (code, message) => ({ code, message });
const isValidId = (value) => mongoose.isValidObjectId(value);
const normalizeCallType = (callType) => callType ?? CALL_TYPES.VOICE;
const isValidCallType = (callType) => Object.values(CALL_TYPES).includes(callType);

const normalizeCallSession = (callSession) => {
  if (!callSession) return null;
  const raw = callSession.toObject ? callSession.toObject() : callSession;

  return {
    callSessionId: toIdString(raw._id),
    conversationId: toIdString(raw.conversationId),
    callerId: toIdString(raw.callerId),
    receiverId: toIdString(raw.receiverId),
    callType: raw.callType ?? CALL_TYPES.VOICE,
    status: raw.status,
    startedAt: raw.startedAt ?? null,
    acceptedAt: raw.acceptedAt ?? null,
    endedAt: raw.endedAt ?? null,
    durationSeconds: raw.durationSeconds ?? 0,
    endReason: raw.endReason ?? null,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
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
  activeCallsByUser.set(toIdString(callSession.receiverId), callSessionId);
};

const clearRingingTimeout = (callSessionId) => {
  const timeout = timeoutByCallId.get(callSessionId);
  if (timeout) {
    clearTimeout(timeout);
    timeoutByCallId.delete(callSessionId);
  }
};

const cleanupActiveCall = (callSession) => {
  const callSessionId = toIdString(callSession._id);
  clearRingingTimeout(callSessionId);
  activeCallIds.delete(callSessionId);
  activeCallsByUser.delete(toIdString(callSession.callerId));
  activeCallsByUser.delete(toIdString(callSession.receiverId));
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
      return `${label} đã kết thúc (${callSession.durationSeconds ?? 0}s)`;
    case CALL_STATUSES.FAILED:
      return `${label} thất bại`;
    default:
      return label;
  }
};

const createCallHistoryMessage = async (callSession) => {
  if (!terminalStatuses.has(callSession.status)) return null;

  const conversation = await Conversation.findById(callSession.conversationId);
  if (!conversation || conversation.type !== "direct") return null;

  const message = await Message.create({
    conversationId: conversation._id,
    senderId: null,
    senderDeleted: false,
    type: "system",
    content: getCallHistoryContent(callSession),
    callMetadata: {
      callSessionId: callSession._id,
      callType: callSession.callType ?? CALL_TYPES.VOICE,
      callStatus: callSession.status,
      callDurationSeconds: callSession.durationSeconds ?? 0,
      callerId: callSession.callerId,
      receiverId: callSession.receiverId,
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
  callSession.durationSeconds = calculateDurationSeconds(callSession, endedAt);

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
    callType: resolvedCallType,
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
    return null;
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
  if (error.code === CALL_ERROR_CODES.USER_BUSY) {
    emitCallBusy(userId, { ...error, callSessionId: callSessionId ?? null });
    return;
  }

  emitCallError(userId, error, { callSessionId: callSessionId ?? null });
};
