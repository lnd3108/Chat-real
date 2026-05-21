import { Mic, MicOff, PhoneOff, ShieldX } from "lucide-react";
import { useMemo } from "react";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { formatCallDuration } from "@/features/chat/calls/call-format";
import GroupCallAudioRenderer from "@/features/chat/calls/group/components/GroupCallAudioRenderer";
import GroupCallParticipantItem from "@/features/chat/calls/group/components/GroupCallParticipantItem";
import { useGroupCallStore } from "@/features/chat/calls/group/group-call.store";
import type { GroupCallParticipant } from "@/features/chat/calls/group/group-call.types";
import { getParticipantId, getParticipantProfile } from "@/features/chat/lib/chatParticipants";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import { Button } from "@/shared/ui/button";

const GroupCallPanel = () => {
  const activeGroupCall = useGroupCallStore((state) => state.activeGroupCall);
  const participants = useGroupCallStore((state) => state.participants);
  const remoteStreamsByUserId = useGroupCallStore(
    (state) => state.remoteStreamsByUserId,
  );
  const durationSeconds = useGroupCallStore((state) => state.durationSeconds);
  const isMuted = useGroupCallStore((state) => state.isMuted);
  const toggleMute = useGroupCallStore((state) => state.toggleMute);
  const leaveGroupCall = useGroupCallStore((state) => state.leaveGroupCall);
  const endGroupCall = useGroupCallStore((state) => state.endGroupCall);
  const conversations = useChatStore((state) => state.conversations);
  const currentUserId = useAuthStore((state) => state.user?._id);

  const conversation = conversations.find(
    (item) => item._id === activeGroupCall?.conversationId,
  );
  const groupName = conversation?.group?.name || "Cuộc gọi nhóm";
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
        return {
          ...participant,
          displayName: participant.displayName || profile?.displayName,
          username: participant.username || profile?.userName,
          avatarUrl: participant.avatarUrl ?? profile?.avatarUrl ?? null,
          isMuted: participant.userId === currentUserId ? isMuted : participant.isMuted,
        };
      });
  }, [conversation?.participants, currentUserId, isMuted, participants]);

  if (!activeGroupCall) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-lg border bg-background p-3 shadow-lg">
      <GroupCallAudioRenderer streamsByUserId={remoteStreamsByUserId} />
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{groupName}</p>
            <p className="text-xs text-muted-foreground">
              {formatCallDuration(durationSeconds)} • {hydratedParticipants.length} người
              đang tham gia
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={toggleMute}>
            {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            <span className="sr-only">{isMuted ? "Bật mic" : "Tắt mic"}</span>
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

        <div className="grid max-h-52 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {hydratedParticipants.map((participant) => (
            <GroupCallParticipantItem
              key={participant.userId}
              participant={participant}
              isCurrentUser={participant.userId === currentUserId}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default GroupCallPanel;
