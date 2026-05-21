import { toast } from "sonner";
import type { Socket } from "socket.io-client";
import { CALL_ERROR_MESSAGES, CALL_SOCKET_EVENTS, CALL_STATUS } from "@/features/chat/calls/call.constants";
import { playIncomingRingtone, stopRingtone } from "@/features/chat/calls/call-ringtone.service";
import { useGroupCallStore } from "@/features/chat/calls/group/group-call.store";
import { useCallStore } from "@/features/chat/calls/call.store";
import type { CallErrorPayload, CallSessionPayload, CallSignalPayload } from "@/features/chat/calls/call.types";
import { webRTCVoiceCallService } from "@/features/chat/calls/webrtc.service";

const getErrorMessage = (payload: CallErrorPayload) =>
  (payload.code && CALL_ERROR_MESSAGES[payload.code]) ||
  payload.message ||
  "Không thể thực hiện cuộc gọi.";

const shouldClearCallOnError = (code?: string) =>
  [
    "CALL_NOT_DIRECT_CONVERSATION",
    "CALL_CONVERSATION_NOT_FOUND",
    "CALL_FORBIDDEN",
    "CALL_BLOCKED",
    "CALL_RECEIVER_OFFLINE",
    "CALL_USER_BUSY",
    "CALL_NOT_FOUND",
    "CALL_INVALID_TYPE",
    "CALL_VIDEO_NOT_SUPPORTED",
    "CALL_INVALID_STATE",
  ].includes(code ?? "");

export class CallSocketHandler {
  private socket: Socket | null = null;

  register(socket: Socket) {
    this.unregister(socket);
    this.socket = socket;
    useCallStore.getState().setSocket(socket);

    socket.on(CALL_SOCKET_EVENTS.INCOMING, this.handleIncoming);
    socket.on(CALL_SOCKET_EVENTS.ACCEPTED, this.handleAccepted);
    socket.on(CALL_SOCKET_EVENTS.REJECTED, this.handleRejected);
    socket.on(CALL_SOCKET_EVENTS.CANCELLED, this.handleCancelled);
    socket.on(CALL_SOCKET_EVENTS.ENDED, this.handleEnded);
    socket.on(CALL_SOCKET_EVENTS.MISSED, this.handleMissed);
    socket.on(CALL_SOCKET_EVENTS.BUSY, this.handleBusy);
    socket.on(CALL_SOCKET_EVENTS.ERROR, this.handleError);
    socket.on(CALL_SOCKET_EVENTS.OFFER, this.handleOffer);
    socket.on(CALL_SOCKET_EVENTS.ANSWER, this.handleAnswer);
    socket.on(CALL_SOCKET_EVENTS.ICE_CANDIDATE, this.handleIceCandidate);
  }

  unregister(socket: Socket) {
    socket.off(CALL_SOCKET_EVENTS.INCOMING, this.handleIncoming);
    socket.off(CALL_SOCKET_EVENTS.ACCEPTED, this.handleAccepted);
    socket.off(CALL_SOCKET_EVENTS.REJECTED, this.handleRejected);
    socket.off(CALL_SOCKET_EVENTS.CANCELLED, this.handleCancelled);
    socket.off(CALL_SOCKET_EVENTS.ENDED, this.handleEnded);
    socket.off(CALL_SOCKET_EVENTS.MISSED, this.handleMissed);
    socket.off(CALL_SOCKET_EVENTS.BUSY, this.handleBusy);
    socket.off(CALL_SOCKET_EVENTS.ERROR, this.handleError);
    socket.off(CALL_SOCKET_EVENTS.OFFER, this.handleOffer);
    socket.off(CALL_SOCKET_EVENTS.ANSWER, this.handleAnswer);
    socket.off(CALL_SOCKET_EVENTS.ICE_CANDIDATE, this.handleIceCandidate);
    if (this.socket === socket) {
      this.socket = null;
      useCallStore.getState().setSocket(null);
    }
    stopRingtone();
  }

  private emitSignal = (eventName: string, payload: Record<string, unknown>) => {
    this.socket?.emit(eventName, payload);
  };

  private handleIncoming = (call: CallSessionPayload) => {
    const callState = useCallStore.getState();
    const groupCallState = useGroupCallStore.getState();
    if (
      callState.currentCall ||
      callState.incomingCall ||
      groupCallState.activeGroupCall ||
      groupCallState.incomingGroupCall
    ) {
      this.socket?.emit(CALL_SOCKET_EVENTS.REJECT, { callSessionId: call.callSessionId });
      return;
    }

    callState.setIncomingCall(call);
    playIncomingRingtone();
  };

  private handleAccepted = (call: CallSessionPayload) => {
    stopRingtone();
    const callState = useCallStore.getState();
    callState.setCurrentCall(call);
    callState.startAcceptedCallTimer(call);
    callState.setCallStatus(CALL_STATUS.CONNECTING);

    void webRTCVoiceCallService
      .startAsCaller(call.callSessionId, this.emitSignal, call.callType ?? "voice")
      .catch(() => {
        callState.setMicPermissionDenied(true);
        if (call.callType === "video") {
          callState.setCameraPermissionDenied(true);
        }
        callState.endCall(call.callSessionId);
      });
  };

  private handleRejected = () => {
    stopRingtone();
    useCallStore.getState().clearCall();
    toast.info("Cuộc gọi đã bị từ chối.");
  };

  private handleCancelled = () => {
    stopRingtone();
    useCallStore.getState().clearCall();
    toast.info("Cuộc gọi đã bị hủy.");
  };

  private handleEnded = () => {
    stopRingtone();
    useCallStore.getState().clearCall();
    toast.info("Cuộc gọi đã kết thúc.");
  };

  private handleMissed = () => {
    stopRingtone();
    useCallStore.getState().clearCall();
    toast.info("Cuộc gọi nhỡ.");
  };

  private handleBusy = (payload: CallErrorPayload) => {
    stopRingtone();
    const message = getErrorMessage(payload);
    useCallStore.getState().clearCall();
    useCallStore.getState().setError(message);
    toast.error(message);
  };

  private handleError = (payload: CallErrorPayload) => {
    stopRingtone();
    const message = getErrorMessage(payload);
    useCallStore.getState().setError(message);
    if (shouldClearCallOnError(payload.code)) {
      useCallStore.getState().clearCall();
    }
    toast.error(message);
  };

  private handleOffer = (signal: CallSignalPayload<RTCSessionDescriptionInit>) => {
    stopRingtone();
    const callState = useCallStore.getState();
    const call = callState.currentCall ?? callState.incomingCall;
    if (!call) return;

    callState.setCurrentCall(call);
    callState.setIncomingCall(null);
    callState.setCallStatus(CALL_STATUS.CONNECTING);

    void webRTCVoiceCallService
      .handleOffer(
        signal.callSessionId,
        signal.payload,
        this.emitSignal,
        call.callType ?? "voice",
      )
      .then(() => callState.setCallStatus(CALL_STATUS.ACTIVE))
      .catch(() => {
        callState.setMicPermissionDenied(true);
        if (call.callType === "video") {
          callState.setCameraPermissionDenied(true);
        }
        callState.endCall(signal.callSessionId);
      });
  };

  private handleAnswer = (signal: CallSignalPayload<RTCSessionDescriptionInit>) => {
    void webRTCVoiceCallService
      .handleAnswer(signal.payload)
      .then(() => useCallStore.getState().setCallStatus(CALL_STATUS.ACTIVE))
      .catch(() => {
        useCallStore.getState().setError("Không thể kết nối âm thanh hoặc video.");
      });
  };

  private handleIceCandidate = (signal: CallSignalPayload<RTCIceCandidateInit>) => {
    void webRTCVoiceCallService.handleIceCandidate(signal.payload).catch(() => {
      useCallStore.getState().setError("Không thể xử lý tín hiệu ICE.");
    });
  };
}
