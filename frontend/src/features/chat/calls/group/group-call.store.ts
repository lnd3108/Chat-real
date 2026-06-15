import { create } from "zustand";
import { toast } from "sonner";
import type { Socket } from "socket.io-client";
import { stopRingtone } from "@/features/chat/calls/call-ringtone.service";
import {
  GROUP_CALL_CAMERA_ERROR,
  GROUP_CALL_ERROR_MESSAGES,
  GROUP_CALL_MIC_ERROR,
  GROUP_CALL_SOCKET_EVENTS,
} from "@/features/chat/calls/group/group-call.constants";
import type {
  GroupCallMediaState,
  GroupCallParticipant,
  GroupCallType,
  GroupCallSessionPayload,
  GroupCallState,
} from "@/features/chat/calls/group/group-call.types";
import { groupWebRTCMeshService } from "@/features/chat/calls/group/group-webrtc-mesh.service";
import { useCallStore } from "@/features/chat/calls/call.store";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";

let durationTimer: ReturnType<typeof setInterval> | null = null;

const stopDurationTimer = () => {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
};

const getCallId = (call?: { callId?: string; callSessionId?: string } | null) =>
  call?.callId ?? call?.callSessionId ?? null;

const formatGroupCallError = (code?: string, message?: string) =>
  (code && GROUP_CALL_ERROR_MESSAGES[code]) ||
  message ||
  "Không thể thực hiện cuộc gọi nhóm.";

const normalizeParticipants = (
  participants?: GroupCallParticipant[],
): GroupCallParticipant[] =>
  (participants ?? []).map((participant) => ({
    ...participant,
    userId: participant.userId?.toString(),
    audioEnabled:
      participant.audioEnabled ?? participant.mediaState?.audioEnabled ?? true,
    videoEnabled:
      participant.videoEnabled ?? participant.mediaState?.videoEnabled ?? false,
    isMuted:
      participant.isMuted ??
      !(
        participant.audioEnabled ??
        participant.mediaState?.audioEnabled ??
        true
      ),
  }));

const getJoinedPeerIdsBeforeSelf = (
  call: GroupCallSessionPayload,
  currentUserId?: string | null,
) => {
  if (!currentUserId) return [];

  const self = call.participants?.find(
    (participant) => participant.userId === currentUserId,
  );
  const selfJoinedAt = self?.joinedAt ? new Date(self.joinedAt).getTime() : Date.now();

  return (call.participants ?? [])
    .filter((participant) => {
      if (participant.userId === currentUserId || participant.status !== "joined") {
        return false;
      }
      const participantJoinedAt = participant.joinedAt
        ? new Date(participant.joinedAt).getTime()
        : 0;
      return participantJoinedAt <= selfJoinedAt;
    })
    .map((participant) => participant.userId);
};

const getLatestJoinedParticipantId = (call: GroupCallSessionPayload) =>
  [...(call.participants ?? [])]
    .filter((participant) => participant.status === "joined")
    .sort((left, right) => {
      const leftTime = left.joinedAt ? new Date(left.joinedAt).getTime() : 0;
      const rightTime = right.joinedAt ? new Date(right.joinedAt).getTime() : 0;
      return rightTime - leftTime;
    })[0]?.userId ?? null;

export const useGroupCallStore = create<GroupCallState>((set, get) => {
  const startDurationTimer = (startedAt = Date.now()) => {
    stopDurationTimer();
    set({
      acceptedAt: new Date(startedAt).toISOString(),
      durationSeconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
    });
    durationTimer = setInterval(() => {
      const acceptedAt = get().acceptedAt;
      if (!acceptedAt) return;
      const start = new Date(acceptedAt).getTime();
      set({
        durationSeconds: Math.max(0, Math.floor((Date.now() - start) / 1000)),
      });
    }, 1000);
  };

  const emitCommand = (
    eventName: string,
    payload: Record<string, unknown>,
    onPayload?: (payload: GroupCallSessionPayload | null) => void,
  ) => {
    const socket = get().socket;
    if (!socket) {
      const message = "Socket chưa sẵn sàng cho cuộc gọi nhóm.";
      set({ error: message, isJoining: false });
      toast.error(message);
      return;
    }

    socket.emit(
      eventName,
      payload,
      (response?: {
        error?: { code?: string; message?: string };
        payload?: GroupCallSessionPayload | null;
      }) => {
        if (response?.error) {
          const message = formatGroupCallError(
            response.error.code,
            response.error.message,
          );
          stopRingtone();
          groupWebRTCMeshService.cleanupAllPeers();
          set({
            error: message,
            incomingGroupCall: null,
            isJoining: false,
            localStream: null,
            remoteStreamsByUserId: {},
            peerConnectionsByUserId: new Map(),
          });
          toast.error(message, { id: response.error.code ?? "group-call-error" });
          return;
        }

        onPayload?.(response?.payload ?? null);
      },
    );
  };

  const emitMediaState = (mediaState: GroupCallMediaState) => {
    const callId = getCallId(get().activeGroupCall);
    if (!callId) return;
    get().socket?.emit(GROUP_CALL_SOCKET_EVENTS.MEDIA_STATE, {
      callId,
      ...mediaState,
    });
  };

  const startGroupCall = (conversationId: string, callType: GroupCallType) => {
    if (useCallStore.getState().currentCall || useCallStore.getState().incomingCall) {
      toast.error("Bạn đang trong cuộc gọi khác.");
      return;
    }
    if (get().activeGroupCall || get().incomingGroupCall) {
      toast.error("Bạn đang trong cuộc gọi nhóm khác.");
      return;
    }

    set({ isJoining: true, error: null });
    void groupWebRTCMeshService
      .initLocalMedia(callType)
      .then(() => {
        emitCommand(
          GROUP_CALL_SOCKET_EVENTS.START,
          { conversationId, callType },
          (call) => {
            if (!call) return;
            get().handleJoinedState(call);
          },
        );
      })
      .catch(() => {
        groupWebRTCMeshService.cleanupAllPeers();
        const message =
          callType === "video" ? GROUP_CALL_CAMERA_ERROR : GROUP_CALL_MIC_ERROR;
        set({ isJoining: false, error: message });
        toast.error(message);
      });
  };

  const acceptGroupCallByType = (callId?: string, requestedType?: GroupCallType) => {
    const incomingCall = get().incomingGroupCall;
    const targetCallId = callId ?? getCallId(incomingCall);
    if (!targetCallId) return;

    if (useCallStore.getState().currentCall || useCallStore.getState().incomingCall) {
      toast.error("Bạn đang trong cuộc gọi khác.");
      return;
    }

    const callType = requestedType ?? incomingCall?.callType ?? "voice";
    stopRingtone();
    set({ isJoining: true, error: null });
    void groupWebRTCMeshService
      .initLocalMedia(callType)
      .then(() => {
        emitCommand(GROUP_CALL_SOCKET_EVENTS.JOIN, { callId: targetCallId }, (call) => {
          if (!call) return;
          get().handleJoinedState(call);
        });
      })
      .catch(() => {
        groupWebRTCMeshService.cleanupAllPeers();
        const message =
          callType === "video" ? GROUP_CALL_CAMERA_ERROR : GROUP_CALL_MIC_ERROR;
        set({ isJoining: false, error: message });
        toast.error(message);
      });
  };

  return {
    socket: null,
    activeGroupCall: null,
    incomingGroupCall: null,
    participants: [],
    localStream: null,
    remoteStreamsByUserId: {},
    peerConnectionsByUserId: new Map(),
    isMuted: false,
    isCameraEnabled: true,
    isJoining: false,
    isConnected: false,
    error: null,
    acceptedAt: null,
    joinedAt: null,
    durationSeconds: 0,

    setSocket: (socket: Socket | null) => set({ socket }),

    startGroupVoiceCall: (conversationId: string) => {
      if (useCallStore.getState().currentCall || useCallStore.getState().incomingCall) {
        toast.error("Bạn đang trong một cuộc gọi khác.");
        return;
      }
      if (get().activeGroupCall || get().incomingGroupCall) {
        toast.error("Bạn đang trong một cuộc gọi nhóm khác.");
        return;
      }

      set({ isJoining: true, error: null });
      void groupWebRTCMeshService
        .initLocalAudio()
        .then(() => {
          emitCommand(
            GROUP_CALL_SOCKET_EVENTS.START,
            { conversationId, callType: "voice" },
            (call) => {
              if (!call) return;
              get().handleJoinedState(call);
            },
          );
        })
        .catch(() => {
          groupWebRTCMeshService.cleanupAllPeers();
          set({ isJoining: false, error: GROUP_CALL_MIC_ERROR });
          toast.error(GROUP_CALL_MIC_ERROR);
        });
    },

    startGroupVideoCall: (conversationId: string) => startGroupCall(conversationId, "video"),

    acceptGroupCall: (callId?: string) => {
      const targetCallId = callId ?? getCallId(get().incomingGroupCall);
      if (!targetCallId) return;

      if (useCallStore.getState().currentCall || useCallStore.getState().incomingCall) {
        toast.error("Bạn đang trong một cuộc gọi khác.");
        return;
      }

      stopRingtone();
      set({ isJoining: true, error: null });
      void groupWebRTCMeshService
        .initLocalAudio()
        .then(() => {
          emitCommand(GROUP_CALL_SOCKET_EVENTS.JOIN, { callId: targetCallId }, (call) => {
            if (!call) return;
            get().handleJoinedState(call);
          });
        })
        .catch(() => {
          groupWebRTCMeshService.cleanupAllPeers();
          set({ isJoining: false, error: GROUP_CALL_MIC_ERROR });
          toast.error(GROUP_CALL_MIC_ERROR);
        });
    },

    acceptGroupVideoCall: (callId?: string) => acceptGroupCallByType(callId, "video"),

    declineGroupCall: (callId?: string) => {
      const targetCallId = callId ?? getCallId(get().incomingGroupCall);
      stopRingtone();
      if (targetCallId) {
        emitCommand(GROUP_CALL_SOCKET_EVENTS.DECLINE, { callId: targetCallId });
      }
      set({ incomingGroupCall: null, isJoining: false });
    },

    leaveGroupCall: (callId?: string) => {
      const targetCallId = callId ?? getCallId(get().activeGroupCall);
      stopRingtone();
      if (targetCallId) {
        emitCommand(GROUP_CALL_SOCKET_EVENTS.LEAVE, { callId: targetCallId });
      }
      get().clearGroupCall();
    },

    endGroupCall: (callId?: string) => {
      const targetCallId = callId ?? getCallId(get().activeGroupCall);
      stopRingtone();
      if (targetCallId) {
        emitCommand(GROUP_CALL_SOCKET_EVENTS.END, { callId: targetCallId });
      }
      get().clearGroupCall();
    },

    toggleMute: () => {
      const isMuted = groupWebRTCMeshService.toggleMic();
      const mediaState = groupWebRTCMeshService.getMediaState();
      set({ isMuted });
      get().updateParticipantMediaState(useAuthStore.getState().user?._id ?? "", mediaState);
      emitMediaState(mediaState);
    },

    toggleCamera: () => {
      const isCameraEnabled = groupWebRTCMeshService.toggleCamera();
      const mediaState = groupWebRTCMeshService.getMediaState();
      set({ isCameraEnabled });
      get().updateParticipantMediaState(useAuthStore.getState().user?._id ?? "", mediaState);
      emitMediaState(mediaState);
    },

    clearGroupCall: () => {
      stopRingtone();
      stopDurationTimer();
      groupWebRTCMeshService.cleanupAllPeers();
      set({
        activeGroupCall: null,
        incomingGroupCall: null,
        participants: [],
        localStream: null,
        remoteStreamsByUserId: {},
        peerConnectionsByUserId: new Map(),
        isMuted: false,
        isCameraEnabled: true,
        isJoining: false,
        isConnected: false,
        error: null,
        acceptedAt: null,
        joinedAt: null,
        durationSeconds: 0,
      });
    },

    setIncomingGroupCall: (call) =>
      set({ incomingGroupCall: call, error: null, isJoining: false }),

    setActiveGroupCall: (call) =>
      set({
        activeGroupCall: call,
        participants: normalizeParticipants(call?.participants),
      }),

    addParticipant: (participant) =>
      set((state) => ({
        participants: [
          ...state.participants.filter((item) => item.userId !== participant.userId),
          participant,
        ],
      })),

    removeParticipant: (userId) =>
      set((state) => ({
        participants: state.participants.map((participant) =>
          participant.userId === userId
            ? { ...participant, status: "left" }
            : participant,
        ),
      })),

    updateParticipantMediaState: (userId, mediaState) => {
      if (!userId) return;
      set((state) => ({
        participants: state.participants.map((participant) =>
          participant.userId === userId
            ? {
                ...participant,
                mediaState: {
                  audioEnabled:
                    mediaState.audioEnabled ??
                    participant.mediaState?.audioEnabled ??
                    participant.audioEnabled ??
                    true,
                  videoEnabled:
                    mediaState.videoEnabled ??
                    participant.mediaState?.videoEnabled ??
                    participant.videoEnabled ??
                    false,
                },
                audioEnabled:
                  mediaState.audioEnabled ?? participant.audioEnabled ?? true,
                videoEnabled:
                  mediaState.videoEnabled ?? participant.videoEnabled ?? false,
                isMuted:
                  mediaState.audioEnabled === undefined
                    ? participant.isMuted
                    : !mediaState.audioEnabled,
              }
            : participant,
        ),
      }));
    },

    upsertParticipants: (participants) => {
      const normalized = normalizeParticipants(participants);
      set((state) => {
        const byUserId = new Map(
          state.participants.map((participant) => [participant.userId, participant]),
        );
        normalized.forEach((participant) => {
          byUserId.set(participant.userId, {
            ...byUserId.get(participant.userId),
            ...participant,
          });
        });
        return { participants: [...byUserId.values()] };
      });
    },

    setRemoteStream: (userId, stream) =>
      set((state) => {
        const next = { ...state.remoteStreamsByUserId };
        if (stream) next[userId] = stream;
        else delete next[userId];
        return { remoteStreamsByUserId: next };
      }),

    setLocalStream: (stream) => set({ localStream: stream }),

    setPeerConnection: (userId, peerConnection) =>
      set((state) => {
        const next = new Map(state.peerConnectionsByUserId);
        if (peerConnection) next.set(userId, peerConnection);
        else next.delete(userId);
        return { peerConnectionsByUserId: next };
      }),

    cleanupPeer: (userId) => {
      groupWebRTCMeshService.cleanupPeer(userId);
      get().removeParticipant(userId);
    },

    cleanupAllPeers: () => {
      groupWebRTCMeshService.cleanupAllPeers();
      set({
        remoteStreamsByUserId: {},
        peerConnectionsByUserId: new Map(),
        localStream: null,
      });
    },

    setError: (message) => set({ error: message }),

    handleJoinedState: (call) => {
      const joinedAt = new Date().toISOString();
      const callId = getCallId(call);
      if (!callId) return;

      const currentState = get();
      if (
        currentState.isConnected &&
        getCallId(currentState.activeGroupCall) === callId
      ) {
        set({
          activeGroupCall: call,
          incomingGroupCall: null,
          participants: normalizeParticipants(call.participants),
          isJoining: false,
          error: null,
        });
        return;
      }

      groupWebRTCMeshService.setSignalContext(callId, (eventName, payload) => {
        get().socket?.emit(eventName, payload);
      });

      const mediaState = groupWebRTCMeshService.getMediaState();
      stopRingtone();
      set({
        activeGroupCall: call,
        incomingGroupCall: null,
        participants: normalizeParticipants(call.participants),
        isJoining: false,
        isConnected: true,
        isMuted: !mediaState.audioEnabled,
        isCameraEnabled: call.callType === "video" ? mediaState.videoEnabled : true,
        error: null,
        joinedAt,
      });
      get().updateParticipantMediaState(
        useAuthStore.getState().user?._id ?? getLatestJoinedParticipantId(call) ?? "",
        mediaState,
      );
      emitMediaState(mediaState);
      startDurationTimer(
        call.acceptedAt ? new Date(call.acceptedAt).getTime() : Date.now(),
      );

      const selfUserId =
        useAuthStore.getState().user?._id ?? getLatestJoinedParticipantId(call);
      const peerIds = getJoinedPeerIdsBeforeSelf(call, selfUserId);
      void groupWebRTCMeshService.createOffersForPeers(peerIds).catch(() => {
        set({ error: "Không thể kết nối âm thanh nhóm." });
      });
    },
  };
});

groupWebRTCMeshService.configure({
  setLocalStream: (stream) => useGroupCallStore.getState().setLocalStream(stream),
  setRemoteStream: (userId, stream) =>
    useGroupCallStore.getState().setRemoteStream(userId, stream),
  setPeerConnection: (userId, peerConnection) =>
    useGroupCallStore.getState().setPeerConnection(userId, peerConnection),
  setError: (message) => useGroupCallStore.getState().setError(message),
});
