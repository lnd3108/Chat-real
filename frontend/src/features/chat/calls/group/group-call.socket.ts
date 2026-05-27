import { toast } from "sonner";
import type { Socket } from "socket.io-client";
import { playIncomingRingtone, stopRingtone } from "@/features/chat/calls/call-ringtone.service";
import { useCallStore } from "@/features/chat/calls/call.store";
import {
  GROUP_CALL_ERROR_MESSAGES,
  GROUP_CALL_SOCKET_EVENTS,
} from "@/features/chat/calls/group/group-call.constants";
import { useGroupCallStore } from "@/features/chat/calls/group/group-call.store";
import type {
  GroupCallErrorPayload,
  GroupCallParticipantEventPayload,
  GroupCallSessionPayload,
  GroupCallSignalPayload,
  GroupIncomingCallPayload,
} from "@/features/chat/calls/group/group-call.types";
import { groupWebRTCMeshService } from "@/features/chat/calls/group/group-webrtc-mesh.service";

const getCallId = (payload?: { callId?: string; callSessionId?: string } | null) =>
  payload?.callId ?? payload?.callSessionId ?? null;

const getErrorMessage = (payload: GroupCallErrorPayload) =>
  (payload.code && GROUP_CALL_ERROR_MESSAGES[payload.code]) ||
  payload.message ||
  "Không thể thực hiện cuộc gọi nhóm.";

const shouldClearGroupCallOnError = (code?: string) =>
  [
    "GROUP_CALL_NOT_GROUP_CONVERSATION",
    "GROUP_CALL_FORBIDDEN",
    "GROUP_CALL_ALREADY_ACTIVE",
    "GROUP_CALL_USER_BUSY",
    "GROUP_CALL_NOT_FOUND",
    "GROUP_CALL_INVALID_STATE",
    "GROUP_CALL_NOT_PARTICIPANT",
    "GROUP_CALL_PARTICIPANT_LIMIT_REACHED",
    "GROUP_CALL_VIDEO_NOT_SUPPORTED",
  ].includes(code ?? "");

export class GroupCallSocketHandler {
  private socket: Socket | null = null;

  register(socket: Socket) {
    this.unregister(socket);
    this.socket = socket;
    useGroupCallStore.getState().setSocket(socket);

    socket.on(GROUP_CALL_SOCKET_EVENTS.INCOMING, this.handleIncoming);
    socket.on(GROUP_CALL_SOCKET_EVENTS.STARTED, this.handleStarted);
    socket.on(
      GROUP_CALL_SOCKET_EVENTS.PARTICIPANT_JOINED,
      this.handleParticipantJoined,
    );
    socket.on(GROUP_CALL_SOCKET_EVENTS.PARTICIPANT_LEFT, this.handleParticipantLeft);
    socket.on(
      GROUP_CALL_SOCKET_EVENTS.PARTICIPANT_DECLINED,
      this.handleParticipantDeclined,
    );
    socket.on(
      GROUP_CALL_SOCKET_EVENTS.PARTICIPANT_MISSED,
      this.handleParticipantMissed,
    );
    socket.on(GROUP_CALL_SOCKET_EVENTS.ENDED, this.handleEnded);
    socket.on(GROUP_CALL_SOCKET_EVENTS.CLEANED, this.handleCleaned);
    socket.on(GROUP_CALL_SOCKET_EVENTS.OFFER, this.handleOffer);
    socket.on(GROUP_CALL_SOCKET_EVENTS.ANSWER, this.handleAnswer);
    socket.on(GROUP_CALL_SOCKET_EVENTS.ICE_CANDIDATE, this.handleIceCandidate);
    socket.on(GROUP_CALL_SOCKET_EVENTS.STATE, this.handleState);
    socket.on(GROUP_CALL_SOCKET_EVENTS.BUSY, this.handleBusy);
    socket.on(GROUP_CALL_SOCKET_EVENTS.ERROR, this.handleError);
  }

  unregister(socket: Socket) {
    socket.off(GROUP_CALL_SOCKET_EVENTS.INCOMING, this.handleIncoming);
    socket.off(GROUP_CALL_SOCKET_EVENTS.STARTED, this.handleStarted);
    socket.off(
      GROUP_CALL_SOCKET_EVENTS.PARTICIPANT_JOINED,
      this.handleParticipantJoined,
    );
    socket.off(GROUP_CALL_SOCKET_EVENTS.PARTICIPANT_LEFT, this.handleParticipantLeft);
    socket.off(
      GROUP_CALL_SOCKET_EVENTS.PARTICIPANT_DECLINED,
      this.handleParticipantDeclined,
    );
    socket.off(
      GROUP_CALL_SOCKET_EVENTS.PARTICIPANT_MISSED,
      this.handleParticipantMissed,
    );
    socket.off(GROUP_CALL_SOCKET_EVENTS.ENDED, this.handleEnded);
    socket.off(GROUP_CALL_SOCKET_EVENTS.CLEANED, this.handleCleaned);
    socket.off(GROUP_CALL_SOCKET_EVENTS.OFFER, this.handleOffer);
    socket.off(GROUP_CALL_SOCKET_EVENTS.ANSWER, this.handleAnswer);
    socket.off(GROUP_CALL_SOCKET_EVENTS.ICE_CANDIDATE, this.handleIceCandidate);
    socket.off(GROUP_CALL_SOCKET_EVENTS.STATE, this.handleState);
    socket.off(GROUP_CALL_SOCKET_EVENTS.BUSY, this.handleBusy);
    socket.off(GROUP_CALL_SOCKET_EVENTS.ERROR, this.handleError);

    if (this.socket === socket) {
      this.socket = null;
      useGroupCallStore.getState().setSocket(null);
      useGroupCallStore.getState().clearGroupCall();
    }
    stopRingtone();
  }

  private handleIncoming = (call: GroupIncomingCallPayload) => {
    const state = useGroupCallStore.getState();
    const directCallState = useCallStore.getState();
    const callId = getCallId(call) ?? call.callId;
    if (
      state.activeGroupCall ||
      state.incomingGroupCall ||
      directCallState.currentCall ||
      directCallState.incomingCall
    ) {
      this.socket?.emit(GROUP_CALL_SOCKET_EVENTS.DECLINE, { callId });
      return;
    }

    state.setIncomingGroupCall({
      ...call,
      callId,
    });
    playIncomingRingtone();
  };

  private handleStarted = (call: GroupCallSessionPayload) => {
    const state = useGroupCallStore.getState();
    if (!state.activeGroupCall && state.isJoining) {
      state.handleJoinedState(call);
      return;
    }

    if (state.activeGroupCall?.callSessionId === call.callSessionId) {
      state.setActiveGroupCall(call);
    }
  };

  private handleParticipantJoined = (payload: GroupCallParticipantEventPayload) => {
    const state = useGroupCallStore.getState();
    if (payload.state) {
      state.setActiveGroupCall(payload.state);
      state.upsertParticipants(payload.state.participants ?? []);
    } else {
      state.addParticipant({ userId: payload.userId, status: "joined" });
    }
  };

  private handleParticipantLeft = (payload: GroupCallParticipantEventPayload) => {
    useGroupCallStore.getState().cleanupPeer(payload.userId);
    if (payload.state) {
      useGroupCallStore.getState().setActiveGroupCall(payload.state);
    }
  };

  private handleParticipantDeclined = (payload: GroupCallParticipantEventPayload) => {
    if (payload.state) {
      useGroupCallStore.getState().setActiveGroupCall(payload.state);
      return;
    }
    useGroupCallStore
      .getState()
      .addParticipant({ userId: payload.userId, status: "declined" });
  };

  private handleParticipantMissed = (payload: GroupCallParticipantEventPayload) => {
    if (payload.state) {
      useGroupCallStore.getState().setActiveGroupCall(payload.state);
      return;
    }
    useGroupCallStore
      .getState()
      .addParticipant({ userId: payload.userId, status: "missed" });
  };

  private handleEnded = () => {
    stopRingtone();
    useGroupCallStore.getState().clearGroupCall();
    toast.info("Cuộc gọi thoại nhóm đã kết thúc.");
  };

  private handleCleaned = () => {
    stopRingtone();
    useGroupCallStore.getState().clearGroupCall();
  };

  private handleOffer = (
    signal: GroupCallSignalPayload<RTCSessionDescriptionInit>,
  ) => {
    const callId = getCallId(signal);
    const state = useGroupCallStore.getState();
    if (!callId || !state.activeGroupCall) return;

    groupWebRTCMeshService.setSignalContext(callId, (eventName, payload) => {
      this.socket?.emit(eventName, payload);
    });

    void groupWebRTCMeshService
      .handleOffer(signal.fromUserId, signal.offer as RTCSessionDescriptionInit)
      .catch(() => {
        state.setError("Không thể kết nối âm thanh nhóm.");
      });
  };

  private handleAnswer = (
    signal: GroupCallSignalPayload<RTCSessionDescriptionInit>,
  ) => {
    void groupWebRTCMeshService
      .handleAnswer(signal.fromUserId, signal.answer as RTCSessionDescriptionInit)
      .catch(() => {
        useGroupCallStore.getState().setError("Không thể kết nối âm thanh nhóm.");
      });
  };

  private handleIceCandidate = (
    signal: GroupCallSignalPayload<RTCIceCandidateInit>,
  ) => {
    void groupWebRTCMeshService
      .handleIceCandidate(signal.fromUserId, signal.candidate as RTCIceCandidateInit)
      .catch(() => {
        useGroupCallStore.getState().setError("Không thể xử lý tín hiệu ICE.");
      });
  };

  private handleState = (call: GroupCallSessionPayload) => {
    useGroupCallStore.getState().setActiveGroupCall(call);
  };

  private handleBusy = (payload: GroupCallErrorPayload) => {
    stopRingtone();
    const message = getErrorMessage(payload);
    useGroupCallStore.getState().clearGroupCall();
    useGroupCallStore.getState().setError(message);
    toast.error(message, { id: payload.code ?? "group-call-busy" });
  };

  private handleError = (payload: GroupCallErrorPayload) => {
    stopRingtone();
    const message = getErrorMessage(payload);
    if (shouldClearGroupCallOnError(payload.code)) {
      useGroupCallStore.getState().clearGroupCall();
    }
    useGroupCallStore.getState().setError(message);
    toast.error(message, { id: payload.code ?? "group-call-error" });
  };
}
