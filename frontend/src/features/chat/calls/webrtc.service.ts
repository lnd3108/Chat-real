import { CALL_SOCKET_EVENTS, STUN_SERVERS } from "@/features/chat/calls/call.constants";

type EmitSignal = (eventName: string, payload: Record<string, unknown>) => void;
type WebRTCCallbacks = {
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setMicPermissionDenied: (value: boolean) => void;
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

  async initLocalAudio() {
    if (this.localStream) return this.localStream;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      this.localStream = stream;
      this.callbacks?.setLocalStream(stream);
      this.callbacks?.setMicPermissionDenied(false);
      return stream;
    } catch (error) {
      this.callbacks?.setMicPermissionDenied(true);
      this.callbacks?.setError(
        "Không thể truy cập microphone. Vui lòng cấp quyền và thử lại.",
      );
      throw error;
    }
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

  async startAsCaller(callSessionId: string, emitSignal: EmitSignal) {
    const stream = await this.initLocalAudio();
    const peerConnection = this.createPeerConnection(callSessionId, emitSignal);

    stream.getAudioTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });

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
  ) {
    const stream = await this.initLocalAudio();
    const peerConnection = this.createPeerConnection(callSessionId, emitSignal);

    stream.getAudioTracks().forEach((track) => {
      const alreadyAdded = peerConnection
        .getSenders()
        .some((sender) => sender.track === track);
      if (!alreadyAdded) peerConnection.addTrack(track, stream);
    });

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
