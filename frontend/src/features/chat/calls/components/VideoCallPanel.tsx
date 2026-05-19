import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { formatCallDuration } from "@/features/chat/calls/call-format";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useCallStore } from "@/features/chat/calls/call.store";
import LocalVideoPreview from "@/features/chat/calls/components/LocalVideoPreview";
import RemoteVideo from "@/features/chat/calls/components/RemoteVideo";
import { getParticipantId, getParticipantProfile } from "@/features/chat/lib/chatParticipants";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import { Button } from "@/shared/ui/button";

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
    <div className="fixed inset-3 z-40 min-h-0 overflow-hidden rounded-lg border bg-black shadow-lg sm:inset-4">
      <div className="relative h-full min-h-0 w-full overflow-hidden bg-black">
        <RemoteVideo stream={remoteStream} />
        <div className="absolute left-3 top-3 z-20 max-w-[calc(100%-8rem)] rounded-md bg-background/85 px-3 py-2 shadow-sm backdrop-blur sm:left-4 sm:top-4 sm:max-w-[calc(100%-14rem)]">
          <p className="text-sm font-medium text-foreground">{peerName}</p>
          <p className="text-xs text-muted-foreground">{formatCallDuration(durationSeconds)}</p>
        </div>
        <div className="absolute right-3 top-3 z-30 aspect-video w-28 overflow-hidden rounded-md border bg-background shadow-md sm:right-4 sm:top-4 sm:w-40 md:w-44">
          {isCameraEnabled ? (
            <LocalVideoPreview stream={localStream} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Camera tắt
            </div>
          )}
        </div>
        <div className="absolute bottom-4 left-1/2 z-30 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-lg border bg-background/90 p-2 shadow-lg backdrop-blur sm:gap-3 sm:p-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            title={isMuted ? "Bật mic" : "Tắt mic"}
          >
            {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            <span className="sr-only">{isMuted ? "Bật mic" : "Tắt mic"}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleCamera}
            title={isCameraEnabled ? "Tắt camera" : "Bật camera"}
          >
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
            title="Kết thúc"
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
