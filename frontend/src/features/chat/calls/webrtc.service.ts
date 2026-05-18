import { CALL_SOCKET_EVENTS, STUN_SERVERS } from "@/features/chat/calls/call.constants";
import type { CallType } from "@/features/chat/calls/call.types";

type EmitSignal = (eventName: string, payload: Record<string, unknown>) => void;
type WebRTCCallbacks = {
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setMicPermissionDenied: (value: boolean) => void;
  setCameraPermissionDenied: (value: boolean) => void;
  setScreenReady: (value: boolean) => void;
  setError: (message: string | null) => void;
};

class WebRTCVoiceCallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private emitSignal: EmitSignal | null = null;
  private callSessionId: string | null = null;
  private callbacks: WebRTCCallbacks | null = null;

  configure(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks;
  }

  async initLocalMedia(callType: CallType = "voice") {
    if (this.localStream) return this.localStream;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
      this.localStream = stream;
      this.callbacks?.setLocalStream(stream);
      this.callbacks?.setMicPermissionDenied(false);
      this.callbacks?.setCameraPermissionDenied(false);
      this.callbacks?.setScreenReady(true);
      return stream;
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : "";
      const isVideoCall = callType === "video";
      this.callbacks?.setMicPermissionDenied(true);
      if (isVideoCall) {
        this.callbacks?.setCameraPermissionDenied(true);
      }
      this.callbacks?.setError(
        isVideoCall
          ? errorName === "NotFoundError"
            ? "Không tìm thấy camera. Vui lòng kiểm tra thiết bị."
            : "Không thể truy cập camera hoặc micro. Vui lòng kiểm tra quyền trình duyệt."
          : "Không thể truy cập micro. Vui lòng kiểm tra quyền trình duyệt.",
      );
      throw error;
    }
  }

  async initLocalAudio() {
    return this.initLocalMedia("voice");
  }

  createPeerConnection(callSessionId: string, emitSignal: EmitSignal) {
    if (this.peerConnection) return this.peerConnection;

    this.callSessionId = callSessionId;
    this.emitSignal = emitSignal;
    this.remoteStream = new MediaStream();
    this.callbacks?.setRemoteStream(this.remoteStream);

    const peerConnection = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !this.callSessionId || !this.emitSignal) return;
      this.emitSignal(CALL_SOCKET_EVENTS.ICE_CANDIDATE, {
        callSessionId: this.callSessionId,
        payload: event.candidate.toJSON(),
      });
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        this.remoteStream = stream;
        this.callbacks?.setRemoteStream(stream);
        return;
      }

      if (event.track) {
        this.remoteStream?.addTrack(event.track);
      }
      this.callbacks?.setRemoteStream(this.remoteStream);
    };

    this.peerConnection = peerConnection;
    return peerConnection;
  }

  async startAsCaller(
    callSessionId: string,
    emitSignal: EmitSignal,
    callType: CallType = "voice",
  ) {
    const stream = await this.initLocalMedia(callType);
    const peerConnection = this.createPeerConnection(callSessionId, emitSignal);

    this.addLocalTracks(peerConnection, stream);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    emitSignal(CALL_SOCKET_EVENTS.OFFER, {
      callSessionId,
      payload: offer,
    });
  }

  async handleOffer(
    callSessionId: string,
    offer: RTCSessionDescriptionInit,
    emitSignal: EmitSignal,
    callType: CallType = "voice",
  ) {
    const stream = await this.initLocalMedia(callType);
    const peerConnection = this.createPeerConnection(callSessionId, emitSignal);

    this.addLocalTracks(peerConnection, stream);

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    await this.flushPendingIceCandidates();

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    emitSignal(CALL_SOCKET_EVENTS.ANSWER, {
      callSessionId,
      payload: answer,
    });
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    await this.flushPendingIceCandidates();
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (!candidate) return;

    if (!this.peerConnection?.remoteDescription) {
      this.pendingIceCandidates.push(candidate);
      return;
    }

    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
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

  cleanup() {
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.remoteStream = null;
    this.pendingIceCandidates = [];
    this.emitSignal = null;
    this.callSessionId = null;

    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.callbacks?.setLocalStream(null);
    this.callbacks?.setRemoteStream(null);
    this.callbacks?.setScreenReady(false);
  }

  private addLocalTracks(peerConnection: RTCPeerConnection, stream: MediaStream) {
    stream.getTracks().forEach((track) => {
      const alreadyAdded = peerConnection
        .getSenders()
        .some((sender) => sender.track === track);
      if (!alreadyAdded) peerConnection.addTrack(track, stream);
    });
  }

  private async flushPendingIceCandidates() {
    if (!this.peerConnection?.remoteDescription) return;
    const candidates = [...this.pendingIceCandidates];
    this.pendingIceCandidates = [];

    for (const candidate of candidates) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }
}

export const webRTCVoiceCallService = new WebRTCVoiceCallService();
