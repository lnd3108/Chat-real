import { STUN_SERVERS } from "@/features/chat/calls/call.constants";
import {
  GROUP_CALL_CAMERA_ERROR,
  GROUP_CALL_MIC_ERROR,
  GROUP_CALL_SOCKET_EVENTS,
  GROUP_CALL_UNSUPPORTED_ERROR,
} from "@/features/chat/calls/group/group-call.constants";
import type { GroupCallType } from "@/features/chat/calls/group/group-call.types";

type EmitSignal = (eventName: string, payload: Record<string, unknown>) => void;

interface GroupWebRTCCallbacks {
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (userId: string, stream: MediaStream | null) => void;
  setPeerConnection: (
    userId: string,
    peerConnection: RTCPeerConnection | null,
  ) => void;
  setError: (message: string | null) => void;
}

class GroupWebRTCMeshService {
  private localStream: MediaStream | null = null;
  private peerConnectionsByUserId = new Map<string, RTCPeerConnection>();
  private pendingIceCandidatesByUserId = new Map<string, RTCIceCandidateInit[]>();
  private offeredPeerIds = new Set<string>();
  private emitSignal: EmitSignal | null = null;
  private callId: string | null = null;
  private callbacks: GroupWebRTCCallbacks | null = null;

  configure(callbacks: GroupWebRTCCallbacks) {
    this.callbacks = callbacks;
  }

  setSignalContext(callId: string, emitSignal: EmitSignal) {
    if (this.callId && this.callId !== callId) {
      this.cleanupAllPeers();
    }
    this.callId = callId;
    this.emitSignal = emitSignal;
  }

  async initLocalAudio() {
    return this.initLocalMedia("voice");
  }

  async initLocalMedia(callType: GroupCallType = "voice") {
    if (this.localStream) return this.localStream;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.callbacks?.setError(GROUP_CALL_UNSUPPORTED_ERROR);
      throw new Error(GROUP_CALL_UNSUPPORTED_ERROR);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
      this.localStream = stream;
      this.callbacks?.setLocalStream(stream);
      this.callbacks?.setError(null);
      return stream;
    } catch (error) {
      const errorMessage =
        callType === "video" ? GROUP_CALL_CAMERA_ERROR : GROUP_CALL_MIC_ERROR;
      this.callbacks?.setError(errorMessage);
      throw error;
    }
  }

  createPeerConnection(remoteUserId: string) {
    const existingPeer = this.peerConnectionsByUserId.get(remoteUserId);
    if (existingPeer) return existingPeer;

    const peerConnection = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    this.localStream?.getTracks().forEach((track) => {
      peerConnection.addTrack(track, this.localStream as MediaStream);
    });

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !this.callId || !this.emitSignal) return;

      this.emitSignal(GROUP_CALL_SOCKET_EVENTS.ICE_CANDIDATE, {
        callId: this.callId,
        targetUserId: remoteUserId,
        candidate: event.candidate.toJSON(),
      });
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        this.callbacks?.setRemoteStream(remoteUserId, stream);
        return;
      }

      const remoteStream = new MediaStream();
      if (event.track) remoteStream.addTrack(event.track);
      this.callbacks?.setRemoteStream(remoteUserId, remoteStream);
    };

    this.peerConnectionsByUserId.set(remoteUserId, peerConnection);
    this.callbacks?.setPeerConnection(remoteUserId, peerConnection);
    return peerConnection;
  }

  async createOfferForPeer(remoteUserId: string) {
    if (this.offeredPeerIds.has(remoteUserId)) return;
    this.offeredPeerIds.add(remoteUserId);

    const peerConnection = this.createPeerConnection(remoteUserId);

    try {
      if (peerConnection.signalingState !== "stable") return;

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      if (!this.callId || !this.emitSignal) return;
      this.emitSignal(GROUP_CALL_SOCKET_EVENTS.OFFER, {
        callId: this.callId,
        targetUserId: remoteUserId,
        offer,
      });
    } catch (error) {
      this.offeredPeerIds.delete(remoteUserId);
      throw error;
    }
  }

  async createOffersForPeers(remoteUserIds: string[]) {
    for (const remoteUserId of remoteUserIds) {
      await this.createOfferForPeer(remoteUserId);
    }
  }

  async handleOffer(fromUserId: string, offer: RTCSessionDescriptionInit) {
    await this.initLocalMedia(
      this.localStream?.getVideoTracks().length ? "video" : "voice",
    );
    const peerConnection = this.createPeerConnection(fromUserId);

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    await this.flushPendingIceCandidates(fromUserId);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    if (!this.callId || !this.emitSignal) return;
    this.emitSignal(GROUP_CALL_SOCKET_EVENTS.ANSWER, {
      callId: this.callId,
      targetUserId: fromUserId,
      answer,
    });
  }

  async handleAnswer(fromUserId: string, answer: RTCSessionDescriptionInit) {
    const peerConnection = this.peerConnectionsByUserId.get(fromUserId);
    if (!peerConnection) return;

    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    await this.flushPendingIceCandidates(fromUserId);
  }

  async handleIceCandidate(fromUserId: string, candidate: RTCIceCandidateInit) {
    if (!candidate) return;

    const peerConnection = this.peerConnectionsByUserId.get(fromUserId);
    if (!peerConnection?.remoteDescription) {
      const pending = this.pendingIceCandidatesByUserId.get(fromUserId) ?? [];
      pending.push(candidate);
      this.pendingIceCandidatesByUserId.set(fromUserId, pending);
      return;
    }

    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  toggleMic() {
    if (!this.localStream) return false;
    const nextEnabled = !this.localStream.getAudioTracks().some((track) => track.enabled);
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    return !nextEnabled;
  }

  toggleCamera() {
    if (!this.localStream) return false;
    const videoTracks = this.localStream.getVideoTracks();
    if (videoTracks.length === 0) return false;

    const nextEnabled = !videoTracks.some((track) => track.enabled);
    videoTracks.forEach((track) => {
      track.enabled = nextEnabled;
    });
    return nextEnabled;
  }

  getMediaState() {
    return {
      audioEnabled:
        this.localStream?.getAudioTracks().some((track) => track.enabled) ?? false,
      videoEnabled:
        this.localStream?.getVideoTracks().some((track) => track.enabled) ?? false,
    };
  }

  cleanupPeer(userId: string) {
    const peerConnection = this.peerConnectionsByUserId.get(userId);
    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.close();
    }
    this.peerConnectionsByUserId.delete(userId);
    this.pendingIceCandidatesByUserId.delete(userId);
    this.offeredPeerIds.delete(userId);
    this.callbacks?.setPeerConnection(userId, null);
    this.callbacks?.setRemoteStream(userId, null);
  }

  cleanupAllPeers() {
    [...this.peerConnectionsByUserId.keys()].forEach((userId) => {
      this.cleanupPeer(userId);
    });

    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.callId = null;
    this.emitSignal = null;
    this.pendingIceCandidatesByUserId.clear();
    this.offeredPeerIds.clear();
    this.callbacks?.setLocalStream(null);
  }

  private async flushPendingIceCandidates(userId: string) {
    const peerConnection = this.peerConnectionsByUserId.get(userId);
    if (!peerConnection?.remoteDescription) return;

    const candidates = this.pendingIceCandidatesByUserId.get(userId) ?? [];
    this.pendingIceCandidatesByUserId.delete(userId);

    for (const candidate of candidates) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }
}

export const groupWebRTCMeshService = new GroupWebRTCMeshService();
