import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { cn } from "@/shared/lib/utils";
import type { Participant } from "@/shared/types/chat";
import { Ellipsis, Loader2, Users } from "lucide-react";
import { useState } from "react";

interface GroupChatAvatarProps {
  participants: Participant[];
  type: "chat" | "sidebar";
  avatarUrl?: string | null;
  groupName?: string;
  isUploading?: boolean;
}

const avatarSizeClass = {
  chat: "size-8",
  sidebar: "size-12",
};

const fallbackAvatarSizeClass = {
  chat: "size-7 text-xs",
  sidebar: "size-10 text-sm",
};

const fallbackWrapperClass = {
  chat: "-space-x-2",
  sidebar: "-space-x-3",
};

const GroupChatAvatar = ({
  participants,
  type,
  avatarUrl,
  groupName,
  isUploading = false,
}: GroupChatAvatarProps) => {
  const visibleParticipants = participants.slice(0, 3);
  const showOverflow = participants.length > 3;
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const imageLoaded = !avatarUrl || loadedSrc === avatarUrl;

  if (avatarUrl) {
    return (
      <div className="relative">
        <Avatar
          className={cn(
            avatarSizeClass[type],
            "border border-border/50 transition-all duration-300",
            !imageLoaded && "animate-pulse bg-muted/70",
          )}
        >
          <AvatarImage
            src={avatarUrl}
            alt={groupName ?? "Ảnh đại diện nhóm"}
            className={cn(
              "transition-opacity duration-300",
              imageLoaded ? "opacity-100" : "opacity-0",
            )}
            onLoad={() => setLoadedSrc(avatarUrl)}
            onError={() => setLoadedSrc(avatarUrl)}
          />
          <AvatarFallback className="bg-sky-600 text-white">
            {(groupName ?? "Nhóm").charAt(0)}
          </AvatarFallback>
        </Avatar>

        {(!imageLoaded || isUploading) && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/55 backdrop-blur-[1px]">
            <Loader2
              className={cn(
                "animate-spin text-foreground/80",
                type === "chat" ? "size-3.5" : "size-4",
              )}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex items-center *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        fallbackWrapperClass[type],
      )}
    >
      {visibleParticipants.length > 0 ? (
        visibleParticipants.map((member, index) => (
          <Avatar
            key={`${member._id ?? member.userId ?? index}`}
            className={cn(
              fallbackAvatarSizeClass[type],
              "border border-border/30 bg-slate-200",
            )}
          >
            <AvatarImage
              src={member.avatarUrl ?? undefined}
              alt={member.displayName ?? "Thành viên nhóm"}
            />
            <AvatarFallback className="bg-slate-500 text-white font-semibold">
              {(member.displayName ?? "U").charAt(0)}
            </AvatarFallback>
          </Avatar>
        ))
      ) : (
        <Avatar className={cn(fallbackAvatarSizeClass[type], "bg-slate-200")}>
          <AvatarFallback className="bg-slate-200 text-slate-600">
            <Users className="size-4" />
          </AvatarFallback>
        </Avatar>
      )}

      {/* Nếu nhiều hơn 4 avatar thì render dấu ...* */}
      {showOverflow && (
        <div
          className={cn(
            "z-10 flex items-center justify-center rounded-full border border-border/30 bg-muted text-muted-foreground ring-2 ring-background",
            fallbackAvatarSizeClass[type],
          )}
        >
          <Ellipsis className={type === "chat" ? "size-3.5" : "size-4"} />
        </div>
      )}
    </div>
  );
};

export default GroupChatAvatar;
