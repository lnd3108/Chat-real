import { Mic, MicOff, PhoneOff, ShieldX, Video, VideoOff } from "lucide-react";
import { useMemo } from "react";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { formatCallDuration } from "@/features/chat/calls/call-format";
import GroupVideoTile from "@/features/chat/calls/group/components/GroupVideoTile";
import { useGroupCallStore } from "@/features/chat/calls/group/group-call.store";
import type { GroupCallParticipant } from "@/features/chat/calls/group/group-call.types";
import { getParticipantId, getParticipantProfile } from "@/features/chat/lib/chatParticipants";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import { Button } from "@/shared/ui/button";

const GroupVideoCallPanel = () => {
  const activeGroupCall = useGroupCallStore((state) => state.activeGroupCall);
  const participants = useGroupCallStore((state) => state.participants);
  const localStream = useGroupCallStore((state) => state.localStream);
  const remoteStreamsByUserId = useGroupCallStore(
    (state) => state.remoteStreamsByUserId,
  );
  const durationSeconds = useGroupCallStore((state) => state.durationSeconds);
  const isMuted = useGroupCallStore((state) => state.isMuted);
  const isCameraEnabled = useGroupCallStore((state) => state.isCameraEnabled);
  const toggleMute = useGroupCallStore((state) => state.toggleMute);
  const toggleCamera = useGroupCallStore((state) => state.toggleCamera);
  const leaveGroupCall = useGroupCallStore((state) => state.leaveGroupCall);
  const endGroupCall = useGroupCallStore((state) => state.endGroupCall);
  const conversations = useChatStore((state) => state.conversations);
  const currentUserId = useAuthStore((state) => state.user?._id);

  const conversation = conversations.find(
    (item) => item._id === activeGroupCall?.conversationId,
  );
  const groupName = conversation?.group?.name || "Cuộc gọi video nhóm";
  const isHost =
    Boolean(currentUserId) &&
    (activeGroupCall?.hostId === currentUserId ||
      activeGroupCall?.callerId === currentUserId);

  const hydratedParticipants = useMemo<GroupCallParticipant[]>(() => {
    return participants
      .filter((participant) => participant.status === "joined")
      .map((participant) => {
        const conversationParticipant = conversation?.participants.find(
          (item) => getParticipantId(item) === participant.userId,
        );
        const profile = getParticipantProfile(conversationParticipant);
        const isSelf = participant.userId === currentUserId;
        return {
          ...participant,
          displayName: participant.displayName || profile?.displayName,
          username: participant.username || profile?.userName,
          avatarUrl: participant.avatarUrl ?? profile?.avatarUrl ?? null,
          audioEnabled: isSelf
            ? !isMuted
            : participant.audioEnabled ?? participant.mediaState?.audioEnabled ?? true,
          videoEnabled: isSelf
            ? isCameraEnabled
            : participant.videoEnabled ?? participant.mediaState?.videoEnabled ?? false,
        };
      });
  }, [conversation?.participants, currentUserId, isCameraEnabled, isMuted, participants]);

  if (!activeGroupCall || activeGroupCall.callType !== "video") return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-foreground">{groupName}</h2>
          <p className="text-sm text-muted-foreground">
            {formatCallDuration(durationSeconds)} • {hydratedParticipants.length} người đang tham gia
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="icon" onClick={toggleMute}>
            {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            <span className="sr-only">{isMuted ? "Bật mic" : "Tắt mic"}</span>
          </Button>
          <Button type="button" variant="secondary" size="icon" onClick={toggleCamera}>
            {isCameraEnabled ? <Video className="size-4" /> : <VideoOff className="size-4" />}
            <span className="sr-only">
              {isCameraEnabled ? "Tắt camera" : "Bật camera"}
            </span>
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={() => leaveGroupCall(activeGroupCall.callSessionId)}
          >
            <PhoneOff className="size-4" />
            <span className="sr-only">Rời cuộc gọi</span>
          </Button>
          {isHost && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => endGroupCall(activeGroupCall.callSessionId)}
            >
              <ShieldX className="size-4" />
              <span className="sr-only">Kết thúc cuộc gọi</span>
            </Button>
          )}
        </div>
      </header>

      <main className="grid flex-1 auto-rows-fr gap-3 overflow-y-auto p-3 sm:grid-cols-2">
        {hydratedParticipants.map((participant) => {
          const isLocal = participant.userId === currentUserId;
          return (
            <GroupVideoTile
              key={participant.userId}
              stream={isLocal ? localStream : remoteStreamsByUserId[participant.userId]}
              displayName={participant.displayName || participant.username || "Thành viên"}
              avatarUrl={participant.avatarUrl}
              audioEnabled={participant.audioEnabled}
              videoEnabled={participant.videoEnabled}
              isLocal={isLocal}
            />
          );
        })}
      </main>
    </div>
  );
};

export default GroupVideoCallPanel;
