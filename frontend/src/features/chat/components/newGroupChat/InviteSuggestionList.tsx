import type { Friend } from "@/shared/types/user";
import UserAvatar from "@/features/chat/components/UserAvatar";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface InviteSuggestionListProps {
  filteredFriends: Friend[];
  onSelect: (friend: Friend) => void;
  loading?: boolean;
  selectedUserIds?: string[];
}

const InviteSuggestionList = ({
  filteredFriends,
  onSelect,
  loading = false,
  selectedUserIds = [],
}: InviteSuggestionListProps) => {
  if (loading) {
    return (
      <div className="border rounded-xl mt-3 bg-muted/30 px-4 py-8 flex flex-col items-center justify-center gap-2">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Đang tải danh sách bạn bè...</p>
      </div>
    );
  }

  if (filteredFriends.length === 0) {
    return (
      <div className="border rounded-xl mt-3 bg-muted/30 px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          {filteredFriends.length === 0 && selectedUserIds.length === 0
            ? "Không có bạn bè nào. Hãy kết bạn trước!"
            : "Không tìm thấy kết quả phù hợp"}
        </p>
      </div>
    );
  }

  return (
    <div className="app-scrollbar-thin mt-3 max-h-[280px] divide-y overflow-y-auto rounded-xl border bg-muted/20">
      {filteredFriends.map((friend) => {
        const isSelected = selectedUserIds.includes(friend._id);
        return (
          <div
            key={friend._id}
            onClick={() => onSelect(friend)}
            className={cn(
              "flex items-center gap-3 p-3 cursor-pointer transition-colors",
              isSelected
                ? "bg-primary/10 hover:bg-primary/15"
                : "hover:bg-muted/50",
            )}
          >
            {/* Avatar */}
            <UserAvatar
              type="chat"
              name={friend.displayName}
              avatarUrl={friend.avatarUrl}
              className="size-10"
            />

            {/* Name & Username */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{friend.displayName}</p>
              <p className="text-xs text-muted-foreground truncate">@{friend.userName}</p>
            </div>

            {/* Checkbox / Checkmark */}
            <div
              className={cn(
                "size-5 rounded border-2 flex items-center justify-center transition-all shrink-0",
                isSelected
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/30 hover:border-muted-foreground/60",
              )}
            >
              {isSelected && <Check className="size-3 text-white" strokeWidth={3} />}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default InviteSuggestionList;
