import { create } from "zustand";
import { toast } from "sonner";
import type { Socket } from "socket.io-client";
import { CALL_ERROR_MESSAGES, CALL_SOCKET_EVENTS, CALL_STATUS } from "@/features/chat/calls/call.constants";
import { stopRingtone } from "@/features/chat/calls/call-ringtone.service";
import type { CallSessionPayload, CallState, CallStatus, CallType } from "@/features/chat/calls/call.types";
import { webRTCVoiceCallService } from "@/features/chat/calls/webrtc.service";

let durationTimer: ReturnType<typeof setInterval> | null = null;
let pendingCancelledConversationId: string | null = null;

const stopDurationTimer = () => {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
};

const getCallId = (call?: CallSessionPayload | null) => call?.callSessionId;

const formatError = (code?: string, message?: string) =>
  (code && CALL_ERROR_MESSAGES[code]) || message || "Không thể thực hiện cuộc gọi.";

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

export const useCallStore = create<CallState>((set, get) => {
  const startDurationTimer = (startedAt = Date.now()) => {
    stopDurationTimer();
    set({
      callStartedAt: startedAt,
      durationSeconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
    });
    durationTimer = setInterval(() => {
      const state = get();
      if (!state.callStartedAt) return;
      set({
        durationSeconds: Math.max(
          0,
          Math.floor((Date.now() - state.callStartedAt) / 1000),
        ),
      });
    }, 1000);
  };

  const emitCallCommand = (
    eventName: string,
    payload: Record<string, unknown>,
    onPayload?: (payload: CallSessionPayload | null) => void,
  ) => {
    const socket = get().socket;
    if (!socket) {
      set({ error: "Socket chưa sẵn sàng cho cuộc gọi." });
      return;
    }
    socket.emit(
      eventName,
      payload,
      (response?: {
        error?: { code?: string; message?: string };
        payload?: CallSessionPayload | null;
      }) => {
        if (response?.error) {
          const errorMessage = formatError(response.error.code, response.error.message);
          if (shouldClearCallOnError(response.error.code)) {
            get().clearCall();
          }
          set({ error: errorMessage });
          toast.error(errorMessage);
          return;
        }

        onPayload?.(response?.payload ?? null);
      },
    );
  };

  return {
    socket: null,
    currentCall: null,
    incomingCall: null,
    callStatus: CALL_STATUS.IDLE,
    isMuted: false,
    error: null,
    callStartedAt: null,
    durationSeconds: 0,
    localStream: null,
    remoteStream: null,
    isMicPermissionDenied: false,
    isCameraEnabled: true,
    isCameraPermissionDenied: false,
    isScreenReady: false,

    setSocket: (socket: Socket | null) => set({ socket }),

    startCall: (conversationId: string, receiverId: string) =>
      get().startVoiceCall(conversationId, receiverId),

    startVoiceCall: (conversationId: string, receiverId: string) => {
      get().startVideoOrVoiceCall(conversationId, receiverId, "voice");
    },

    startVideoCall: (conversationId: string, receiverId: string) => {
      get().startVideoOrVoiceCall(conversationId, receiverId, "video");
    },

    startVideoOrVoiceCall: (conversationId: string, receiverId: string, callType: CallType) => {
      if (get().currentCall || get().incomingCall) {
        toast.error("Bạn đang trong một cuộc gọi khác.");
        return;
      }

      pendingCancelledConversationId = null;
      set({
        currentCall: {
          callSessionId: "",
          conversationId,
          callerId: "",
          receiverId,
          callType,
          status: "ringing",
          startedAt: new Date().toISOString(),
        },
        incomingCall: null,
        callStatus: CALL_STATUS.RINGING,
        error: null,
        isMuted: false,
        isCameraEnabled: true,
        isCameraPermissionDenied: false,
        isMicPermissionDenied: false,
        isScreenReady: false,
      });
      emitCallCommand(
        CALL_SOCKET_EVENTS.INVITE,
        { conversationId, receiverId, callType },
        (call) => {
          if (!call) return;

          if (pendingCancelledConversationId === call.conversationId) {
            pendingCancelledConversationId = null;
            emitCallCommand(CALL_SOCKET_EVENTS.CANCEL, {
              callSessionId: call.callSessionId,
            });
            return;
          }

          const state = get();
          if (
            state.callStatus === CALL_STATUS.RINGING &&
            state.currentCall?.conversationId === call.conversationId
          ) {
            set({ currentCall: call });
          }
        },
      );
    },

    acceptCall: (callId?: string) => {
      const targetCallId = callId ?? getCallId(get().incomingCall);
      if (!targetCallId) return;
      stopRingtone();
      emitCallCommand(CALL_SOCKET_EVENTS.ACCEPT, { callSessionId: targetCallId });
      set((state) => ({
        currentCall: state.incomingCall,
        incomingCall: null,
        callStatus: CALL_STATUS.CONNECTING,
        error: null,
      }));
    },

    rejectCall: (callId?: string) => {
      const targetCallId = callId ?? getCallId(get().incomingCall);
      if (!targetCallId) return;
      stopRingtone();
      emitCallCommand(CALL_SOCKET_EVENTS.REJECT, { callSessionId: targetCallId });
      get().clearCall();
    },

    cancelCall: (callId?: string) => {
      const targetCallId = callId ?? getCallId(get().currentCall);
      stopRingtone();
      if (!targetCallId) {
        pendingCancelledConversationId = get().currentCall?.conversationId ?? null;
        get().clearCall();
        return;
      }
      emitCallCommand(CALL_SOCKET_EVENTS.CANCEL, { callSessionId: targetCallId });
      get().clearCall();
    },

    endCall: (callId?: string) => {
      const targetCallId = callId ?? getCallId(get().currentCall);
      stopRingtone();
      if (targetCallId) {
        emitCallCommand(CALL_SOCKET_EVENTS.END, { callSessionId: targetCallId });
      }
      get().clearCall();
    },

    clearCall: () => {
      stopRingtone();
      stopDurationTimer();
      webRTCVoiceCallService.cleanup();
      set({
        currentCall: null,
        incomingCall: null,
        callStatus: CALL_STATUS.IDLE,
        isMuted: false,
        isCameraEnabled: true,
        isCameraPermissionDenied: false,
        isMicPermissionDenied: false,
        isScreenReady: false,
        callStartedAt: null,
        durationSeconds: 0,
        localStream: null,
        remoteStream: null,
      });
    },

    setIncomingCall: (call) =>
      set({
        incomingCall: call,
        callStatus: call ? CALL_STATUS.RINGING : get().callStatus,
        error: null,
      }),

    setCallStatus: (status: CallStatus) => {
      set({ callStatus: status });
      if (status === CALL_STATUS.ACTIVE && !get().callStartedAt) {
        startDurationTimer();
      }
    },

    setCurrentCall: (call) => set({ currentCall: call }),
    setError: (message) => set({ error: message }),
    setLocalStream: (stream) => set({ localStream: stream }),
    setRemoteStream: (stream) => set({ remoteStream: stream }),
    setMicPermissionDenied: (value) => set({ isMicPermissionDenied: value }),
    setCameraPermissionDenied: (value) => set({ isCameraPermissionDenied: value }),
    setScreenReady: (value) => set({ isScreenReady: value }),

    toggleMute: () => {
      const isMuted = webRTCVoiceCallService.toggleMic();
      set({ isMuted });
    },

    toggleCamera: () => {
      const isCameraEnabled = webRTCVoiceCallService.toggleCamera();
      set({ isCameraEnabled });
    },
  };
});

webRTCVoiceCallService.configure({
  setLocalStream: (stream) => useCallStore.getState().setLocalStream(stream),
  setRemoteStream: (stream) => useCallStore.getState().setRemoteStream(stream),
  setMicPermissionDenied: (value) =>
    useCallStore.getState().setMicPermissionDenied(value),
  setCameraPermissionDenied: (value) =>
    useCallStore.getState().setCameraPermissionDenied(value),
  setScreenReady: (value) => useCallStore.getState().setScreenReady(value),
  setError: (message) => useCallStore.getState().setError(message),
});

export const clearCallWithNotice = (message?: string) => {
  useCallStore.getState().clearCall();
  if (message) toast.info(message);
};
