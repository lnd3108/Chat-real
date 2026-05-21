import type { Socket } from "socket.io-client";
import type { GROUP_CALL_STATUS } from "@/features/chat/calls/group/group-call.constants";

export type GroupCallStatus =
  (typeof GROUP_CALL_STATUS)[keyof typeof GROUP_CALL_STATUS];

export type GroupCallParticipantStatus =
  | "invited"
  | "ringing"
  | "joined"
  | "declined"
  | "missed"
  | "left";

export interface GroupCallParticipant {
  userId: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string | null;
  status: GroupCallParticipantStatus;
  invitedAt?: string | null;
  joinedAt?: string | null;
  leftAt?: string | null;
  durationSeconds?: number;
  isSpeaking?: boolean;
  isMuted?: boolean;
}

export interface GroupCallSessionPayload {
  callId?: string;
  callSessionId: string;
  conversationId: string;
  callerId?: string;
  initiatorId?: string;
  hostId?: string;
  callType: "voice";
  callMode: "group";
  status: string;
  startedAt?: string | null;
  acceptedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number;
  endReason?: string | null;
  joinedParticipantIds?: string[];
  joinedCount?: number;
  maxParticipants?: number;
  participants?: GroupCallParticipant[];
}

export interface GroupIncomingCallPayload {
  callId: string;
  callSessionId?: string;
  conversationId: string;
  groupName?: string;
  caller?: {
    _id?: string;
    displayName?: string;
    userName?: string;
    username?: string;
    avatarUrl?: string | null;
  };
  callType: "voice";
  callMode: "group";
}

export interface GroupCallParticipantEventPayload {
  callId: string;
  callSessionId?: string;
  conversationId: string;
  userId: string;
  state?: GroupCallSessionPayload;
}

export interface GroupCallSignalPayload<T = unknown> {
  callId: string;
  callSessionId?: string;
  conversationId?: string;
  fromUserId: string;
  offer?: T;
  answer?: T;
  candidate?: T;
}

export interface GroupCallErrorPayload {
  code?: string;
  message?: string;
  callSessionId?: string | null;
  callId?: string | null;
}

export interface GroupCallState {
  socket: Socket | null;
  activeGroupCall: GroupCallSessionPayload | null;
  incomingGroupCall: GroupIncomingCallPayload | null;
  participants: GroupCallParticipant[];
  localStream: MediaStream | null;
  remoteStreamsByUserId: Record<string, MediaStream>;
  peerConnectionsByUserId: Map<string, RTCPeerConnection>;
  isMuted: boolean;
  isJoining: boolean;
  isConnected: boolean;
  error: string | null;
  acceptedAt: string | null;
  joinedAt: string | null;
  durationSeconds: number;

  setSocket: (socket: Socket | null) => void;
  startGroupVoiceCall: (conversationId: string) => void;
  acceptGroupCall: (callId?: string) => void;
  declineGroupCall: (callId?: string) => void;
  leaveGroupCall: (callId?: string) => void;
  endGroupCall: (callId?: string) => void;
  toggleMute: () => void;
  clearGroupCall: () => void;
  setIncomingGroupCall: (call: GroupIncomingCallPayload | null) => void;
  setActiveGroupCall: (call: GroupCallSessionPayload | null) => void;
  addParticipant: (participant: GroupCallParticipant) => void;
  removeParticipant: (userId: string) => void;
  upsertParticipants: (participants: GroupCallParticipant[]) => void;
  setRemoteStream: (userId: string, stream: MediaStream | null) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setPeerConnection: (
    userId: string,
    peerConnection: RTCPeerConnection | null,
  ) => void;
  cleanupPeer: (userId: string) => void;
  cleanupAllPeers: () => void;
  setError: (message: string | null) => void;
  handleJoinedState: (call: GroupCallSessionPayload) => void;
}
