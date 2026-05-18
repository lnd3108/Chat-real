import type { Socket } from "socket.io-client";
import type { CALL_STATUS } from "@/features/chat/calls/call.constants";

export type CallStatus = (typeof CALL_STATUS)[keyof typeof CALL_STATUS];
export type CallType = "voice" | "video";

export interface CallSessionPayload {
  callSessionId: string;
  conversationId: string;
  callerId: string;
  receiverId: string;
  callType?: CallType;
  status: string;
  startedAt?: string | null;
  acceptedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number;
  endReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CallErrorPayload {
  code?: string;
  message?: string;
  callSessionId?: string | null;
}

export interface CallSignalPayload<T = unknown> {
  callSessionId: string;
  conversationId?: string;
  fromUserId?: string;
  payload: T;
}

export interface CallState {
  socket: Socket | null;
  currentCall: CallSessionPayload | null;
  incomingCall: CallSessionPayload | null;
  callStatus: CallStatus;
  isMuted: boolean;
  error: string | null;
  callStartedAt: number | null;
  durationSeconds: number;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMicPermissionDenied: boolean;
  isCameraEnabled: boolean;
  isCameraPermissionDenied: boolean;
  isScreenReady: boolean;

  setSocket: (socket: Socket | null) => void;
  startCall: (conversationId: string, receiverId: string) => void;
  startVoiceCall: (conversationId: string, receiverId: string) => void;
  startVideoCall: (conversationId: string, receiverId: string) => void;
  startVideoOrVoiceCall: (
    conversationId: string,
    receiverId: string,
    callType: CallType,
  ) => void;
  acceptCall: (callId?: string) => void;
  rejectCall: (callId?: string) => void;
  cancelCall: (callId?: string) => void;
  endCall: (callId?: string) => void;
  clearCall: () => void;
  setIncomingCall: (call: CallSessionPayload | null) => void;
  setCallStatus: (status: CallStatus) => void;
  setCurrentCall: (call: CallSessionPayload | null) => void;
  setError: (message: string | null) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setMicPermissionDenied: (value: boolean) => void;
  setCameraPermissionDenied: (value: boolean) => void;
  setScreenReady: (value: boolean) => void;
  toggleMute: () => void;
  toggleCamera: () => void;
}
