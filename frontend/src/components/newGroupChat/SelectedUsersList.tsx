import type { Friend } from "@/types/user";
import UserAvatar from "../chat/UserAvatar";
import { X } from "lucide-react";

interface SelectedUsersListProps {
  invitedUsers: Friend[];
  onRemove: (user: Friend) => void;
}

const SelectedUsersList = ({
  invitedUsers,
  onRemove,
}: SelectedUsersListProps) => {
  if (invitedUsers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">
          Đã chọn ({invitedUsers.length} thành viên)
        </p>
      </div>
      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-xl">
        {invitedUsers.map((user) => (
          <div
            key={user._id}
            className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-3 py-1.5 text-sm"
          >
            <UserAvatar
              type="chat"
              name={user.displayName}
              avatarUrl={user.avatarUrl}
              className="size-6"
            />
            <span className="font-medium truncate max-w-[120px]">{user.displayName}</span>
            <button
              type="button"
              onClick={() => onRemove(user)}
              className="ml-1 p-0.5 rounded hover:bg-destructive/20 transition-colors"
              title="Bỏ chọn"
            >
              <X className="size-4 hover:text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SelectedUsersList;
