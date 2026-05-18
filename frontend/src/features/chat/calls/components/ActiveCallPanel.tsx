import { Mic, MicOff, PhoneOff } from "lucide-react";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { CALL_STATUS } from "@/features/chat/calls/call.constants";
import { useCallStore } from "@/features/chat/calls/call.store";
import RemoteAudio from "@/features/chat/calls/components/RemoteAudio";
import VideoCallPanel from "@/features/chat/calls/components/VideoCallPanel";
import UserAvatar from "@/features/chat/components/UserAvatar";
import { getParticipantId, getParticipantProfile } from "@/features/chat/lib/chatParticipants";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import { Button } from "@/shared/ui/button";

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
};

const ActiveCallPanel = () => {
  const currentCall = useCallStore((state) => state.currentCall);
  const callStatus = useCallStore((state) => state.callStatus);
  const durationSeconds = useCallStore((state) => state.durationSeconds);
  const isMuted = useCallStore((state) => state.isMuted);
  const remoteStream = useCallStore((state) => state.remoteStream);
  const toggleMute = useCallStore((state) => state.toggleMute);
  const endCall = useCallStore((state) => state.endCall);
  const conversations = useChatStore((state) => state.conversations);
  const currentUserId = useAuthStore((state) => state.user?._id);

  const isVisible =
    Boolean(currentCall) &&
    (callStatus === CALL_STATUS.CONNECTING || callStatus === CALL_STATUS.ACTIVE);

  if (!isVisible || !currentCall) return null;

  if (currentCall.callType === "video") {
    return <VideoCallPanel />;
  }

  const conversation = conversations.find(
    (item) => item._id === currentCall.conversationId,
  );
  const peerParticipant = conversation?.participants.find(
    (participant) => getParticipantId(participant) !== currentUserId,
  );
  const peerProfile = getParticipantProfile(peerParticipant);
  const peerName = peerProfile?.displayName || "Người đang gọi";

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border bg-background p-3 shadow-lg">
      <RemoteAudio stream={remoteStream} />
      <div className="flex items-center gap-3">
        <UserAvatar
          type="sidebar"
          name={peerName}
          avatarUrl={peerProfile?.avatarUrl ?? undefined}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{peerName}</p>
          <p className="text-xs text-muted-foreground">
            {callStatus === CALL_STATUS.ACTIVE
              ? formatDuration(durationSeconds)
              : "Đang kết nối..."}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={toggleMute}>
          {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          <span className="sr-only">{isMuted ? "Bat mic" : "Tat mic"}</span>
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          onClick={() => endCall(currentCall.callSessionId)}
        >
          <PhoneOff className="size-4" />
          <span className="sr-only">Kết thúc cuộc gọi</span>
        </Button>
      </div>
    </div>
  );
};

export default ActiveCallPanel;
