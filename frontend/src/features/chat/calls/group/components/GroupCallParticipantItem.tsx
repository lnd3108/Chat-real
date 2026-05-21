import { Mic, MicOff } from "lucide-react";
import UserAvatar from "@/features/chat/components/UserAvatar";
import type { GroupCallParticipant } from "@/features/chat/calls/group/group-call.types";

const statusLabel: Record<string, string> = {
  invited: "Đã mời",
  ringing: "Đang đổ chuông",
  joined: "Đang tham gia",
  declined: "Đã từ chối",
  missed: "Nhỡ",
  left: "Đã rời",
};

const GroupCallParticipantItem = ({
  participant,
  isCurrentUser,
}: {
  participant: GroupCallParticipant;
  isCurrentUser?: boolean;
}) => {
  const displayName =
    participant.displayName || participant.username || (isCurrentUser ? "Bạn" : "Thành viên");

  return (
    <div className="flex items-center gap-3 rounded-md border bg-card/70 px-3 py-2">
      <UserAvatar
        type="sidebar"
        name={displayName}
        avatarUrl={participant.avatarUrl ?? undefined}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {displayName}
          {isCurrentUser ? " (Bạn)" : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {statusLabel[participant.status] ?? "Đang cập nhật"}
        </p>
      </div>
      {participant.status === "joined" && (
        <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {participant.isMuted ? (
            <MicOff className="size-4" />
          ) : (
            <Mic className="size-4" />
          )}
        </div>
      )}
    </div>
  );
};

export default GroupCallParticipantItem;
