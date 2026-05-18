import { CALL_SOCKET_EVENTS } from "../../../../shared/domain/constants/socket-events.js";
import {
  acceptCall,
  cancelCall,
  emitResultErrorToUser,
  endCall,
  inviteCall,
  rejectCall,
  relayCallSignal,
} from "../../application/call.service.js";

const getCallSessionId = (payload) => payload?.callSessionId ?? payload?.id ?? null;

const ackResult = (ack, result) => {
  if (typeof ack !== "function") return;
  ack(result?.error ? { error: result.error } : { payload: result?.payload ?? null });
};

const handleCommand = (socket, command, ack) => {
  void command().catch((error) => {
    console.error("Lỗi xử lý socket cuộc gọi:", error);
    const payload = {
      code: "CALL_INTERNAL_ERROR",
      message: "Không thể xử lý cuộc gọi",
    };
    socket.emit(CALL_SOCKET_EVENTS.ERROR, payload);
    if (typeof ack === "function") {
      ack({ error: payload });
    }
  });
};

const emitCommandError = ({ socket, result, callSessionId }) => {
  if (!result?.error) return false;

  emitResultErrorToUser({
    userId: socket.user._id,
    error: result.error,
    callSessionId,
  });
  return true;
};

export const registerCallSocketHandlers = (socket) => {
  const userId = socket.user._id.toString();

  socket.on(CALL_SOCKET_EVENTS.INVITE, (payload = {}, ack) => {
    handleCommand(socket, async () => {
      const result = await inviteCall({
        callerId: userId,
        conversationId: payload.conversationId,
        receiverId: payload.receiverId,
        callType: payload.callType,
      });

      emitCommandError({ socket, result });
      ackResult(ack, result);
    }, ack);
  });

  socket.on(CALL_SOCKET_EVENTS.ACCEPT, (payload = {}, ack) => {
    handleCommand(socket, async () => {
      const callSessionId = getCallSessionId(payload);
      const result = await acceptCall({ userId, callSessionId });
      emitCommandError({ socket, result, callSessionId });
      ackResult(ack, result);
    }, ack);
  });

  socket.on(CALL_SOCKET_EVENTS.REJECT, (payload = {}, ack) => {
    handleCommand(socket, async () => {
      const callSessionId = getCallSessionId(payload);
      const result = await rejectCall({ userId, callSessionId });
      emitCommandError({ socket, result, callSessionId });
      ackResult(ack, result);
    }, ack);
  });

  socket.on(CALL_SOCKET_EVENTS.CANCEL, (payload = {}, ack) => {
    handleCommand(socket, async () => {
      const callSessionId = getCallSessionId(payload);
      const result = await cancelCall({ userId, callSessionId });
      emitCommandError({ socket, result, callSessionId });
      ackResult(ack, result);
    }, ack);
  });

  socket.on(CALL_SOCKET_EVENTS.END, (payload = {}, ack) => {
    handleCommand(socket, async () => {
      const callSessionId = getCallSessionId(payload);
      const result = await endCall({ userId, callSessionId });
      emitCommandError({ socket, result, callSessionId });
      ackResult(ack, result);
    }, ack);
  });

  [
    CALL_SOCKET_EVENTS.OFFER,
    CALL_SOCKET_EVENTS.ANSWER,
    CALL_SOCKET_EVENTS.ICE_CANDIDATE,
  ].forEach((eventName) => {
    socket.on(eventName, (payload = {}, ack) => {
      handleCommand(socket, async () => {
        const callSessionId = getCallSessionId(payload);
        const result = await relayCallSignal({
          userId,
          callSessionId,
          eventName,
          signalPayload: payload.payload ?? payload.signal ?? payload,
        });
        emitCommandError({ socket, result, callSessionId });
        ackResult(ack, result);
      }, ack);
    });
  });
};
