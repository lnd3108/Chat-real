import type { FriendRequest } from "@/types/user";
import type { ReactNode } from "react";
import UserAvatar from "../chat/UserAvatar";
import DirectProfileDialog from "../chat/DirectProfileDialog";

interface RequestItemProps {
  requestInfo: FriendRequest;
  actions: ReactNode;
  type: "sent" | "received";
}

const FriendRequestItem = ({
  requestInfo,
  actions,
  type,
}: RequestItemProps) => {
  if (!requestInfo) {
    return;
  }

  const info = type === "sent" ? requestInfo.to : requestInfo.from;

  if (!info) {
    return;
  }

  return (
    <div className="flex items-center justify-between rounded-lg shadow-md border border-primary-foreground p-3 ">
      <DirectProfileDialog
        displayName={info.displayName}
        userName={info.userName}
        avatarUrl={info.avatarUrl}
        statusLabel={type === "sent" ? "Lời mời đã gửi" : "Lời mời kết bạn"}
        trigger={
          <button
            type="button"
            className="flex items-center gap-3 rounded-xl text-left transition-smooth hover:opacity-85"
          >
            <UserAvatar
              type="sidebar"
              name={info.displayName}
              avatarUrl={info.avatarUrl}
              className="size-12"
            />
            <div>
              <p className="font-medium">{info.displayName}</p>
              <p className="text-sm text-muted-foreground">@{info.userName}</p>
            </div>
          </button>
        }
      />
      {actions}
    </div>
  );
};

export default FriendRequestItem;
