import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useCallStore } from "@/features/chat/calls/call.store";
import LocalVideoPreview from "@/features/chat/calls/components/LocalVideoPreview";
import RemoteVideo from "@/features/chat/calls/components/RemoteVideo";
import { getParticipantId, getParticipantProfile } from "@/features/chat/lib/chatParticipants";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import { Button } from "@/shared/ui/button";

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
};

const VideoCallPanel = () => {
  const currentCall = useCallStore((state) => state.currentCall);
  const durationSeconds = useCallStore((state) => state.durationSeconds);
  const isMuted = useCallStore((state) => state.isMuted);
  const isCameraEnabled = useCallStore((state) => state.isCameraEnabled);
  const localStream = useCallStore((state) => state.localStream);
  const remoteStream = useCallStore((state) => state.remoteStream);
  const toggleMute = useCallStore((state) => state.toggleMute);
  const toggleCamera = useCallStore((state) => state.toggleCamera);
  const endCall = useCallStore((state) => state.endCall);
  const conversations = useChatStore((state) => state.conversations);
  const currentUserId = useAuthStore((state) => state.user?._id);

  if (!currentCall) return null;

  const conversation = conversations.find(
    (item) => item._id === currentCall.conversationId,
  );
  const peerParticipant = conversation?.participants.find(
    (participant) => getParticipantId(participant) !== currentUserId,
  );
  const peerProfile = getParticipantProfile(peerParticipant);
  const peerName = peerProfile?.displayName || "Người đang gọi";

  return (
    <div className="fixed inset-4 z-40 overflow-hidden rounded-lg border bg-background shadow-lg">
      <div className="relative h-full w-full bg-muted">
        <RemoteVideo stream={remoteStream} />
        <div className="absolute left-4 top-4 rounded-md bg-background/80 px-3 py-2 shadow-sm">
          <p className="text-sm font-medium text-foreground">{peerName}</p>
          <p className="text-xs text-muted-foreground">{formatDuration(durationSeconds)}</p>
        </div>
        <div className="absolute right-4 top-4 h-32 w-24 overflow-hidden rounded-md border bg-background shadow-md sm:h-40 sm:w-32">
          {isCameraEnabled ? (
            <LocalVideoPreview stream={localStream} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Camera tắt
            </div>
          )}
        </div>
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-background/90 p-3 shadow-lg">
          <Button type="button" variant="ghost" size="icon" onClick={toggleMute}>
            {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            <span className="sr-only">{isMuted ? "Bật mic" : "Tắt mic"}</span>
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={toggleCamera}>
            {isCameraEnabled ? (
              <Video className="size-4" />
            ) : (
              <VideoOff className="size-4" />
            )}
            <span className="sr-only">
              {isCameraEnabled ? "Tắt camera" : "Bật camera"}
            </span>
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={() => endCall(currentCall.callSessionId)}
          >
            <PhoneOff className="size-4" />
            <span className="sr-only">Kết thúc</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VideoCallPanel;
