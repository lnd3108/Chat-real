import { useMemo, useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import UserAvatar from "@/components/chat/UserAvatar";
import { useFriendStore } from "@/stores/useFriendStore";
import type { DiscoverUser } from "@/types/user";
import DirectProfileDialog from "./DirectProfileDialog";

interface UserSuggestionsListProps {
  users: DiscoverUser[];
  title?: string;
  emptyText?: string;
  loading?: boolean;
  compact?: boolean;
}

const getSubtitle = (user: DiscoverUser) => {
  if (user.mutualFriendsCount > 0) {
    return `${user.mutualFriendsCount} bạn chung`;
  }

  if (user.requestReceived) {
    return "Đã gửi lời mời cho bạn";
  }

  return "Gợi ý cho bạn";
};

const UserSuggestionsList = ({
  users,
  title = "Bạn có thể biết",
  emptyText = "Chưa có gợi ý phù hợp.",
  loading = false,
  compact = false,
}: UserSuggestionsListProps) => {
  const { addFriend } = useFriendStore();
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const mergedUsers = useMemo(
    () =>
      users.map((user) =>
        pendingIds.includes(user._id) ? { ...user, requestSent: true, requestReceived: false } : user,
      ),
    [pendingIds, users],
  );

  const handleAddFriend = async (user: DiscoverUser) => {
    if (user.requestSent || user.isFriend || pendingIds.includes(user._id)) {
      return;
    }

    setPendingIds((current) => [...current, user._id]);
    const message = await addFriend(user._id);
    toast.success(message);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
      </div>

      {loading && mergedUsers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
          Đang tải gợi ý...
        </div>
      ) : null}

      {!loading && mergedUsers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : null}

      {mergedUsers.length > 0 ? (
        <div className={compact ? "space-y-2" : "grid gap-3 md:grid-cols-2"}>
          {mergedUsers.map((user) => {
            const requestSent = user.requestSent || pendingIds.includes(user._id);
            const buttonLabel = user.isFriend
              ? "Bạn bè"
              : requestSent
                ? "Đã gửi"
                : user.requestReceived
                  ? "Phản hồi"
                  : "Kết bạn";

            if (compact) {
              return (
                <div
                  key={user._id}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/45 px-3 py-3"
                >
                  <DirectProfileDialog
                    displayName={user.displayName}
                    userName={user.userName}
                    avatarUrl={user.avatarUrl ?? undefined}
                    statusLabel={getSubtitle(user)}
                    trigger={
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition-smooth hover:opacity-85"
                      >
                        <UserAvatar
                          type="sidebar"
                          name={user.displayName}
                          avatarUrl={user.avatarUrl ?? undefined}
                          className="size-10"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{user.displayName}</p>
                          <p className="truncate text-xs text-muted-foreground">@{user.userName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {getSubtitle(user)}
                          </p>
                        </div>
                      </button>
                    }
                  />

                  <Button
                    type="button"
                    size="sm"
                    variant={requestSent || user.isFriend ? "outline" : "default"}
                    disabled={requestSent || user.isFriend}
                    className={
                      requestSent || user.isFriend
                        ? "shrink-0 rounded-xl"
                        : "shrink-0 rounded-xl bg-gradient-chat text-white hover:opacity-90"
                    }
                    onClick={() => void handleAddFriend(user)}
                  >
                    {requestSent || user.isFriend ? null : <UserPlus className="size-4" />}
                    {buttonLabel}
                  </Button>
                </div>
              );
            }

            return (
              <Card
                key={user._id}
                className="flex items-center gap-3 rounded-2xl border-border/60 bg-background/70 px-4 py-4"
              >
                <DirectProfileDialog
                  displayName={user.displayName}
                  userName={user.userName}
                  avatarUrl={user.avatarUrl ?? undefined}
                  statusLabel={getSubtitle(user)}
                  trigger={
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-4 rounded-xl text-left transition-smooth hover:opacity-85"
                    >
                      <UserAvatar
                        type="sidebar"
                        name={user.displayName}
                        avatarUrl={user.avatarUrl ?? undefined}
                        className="size-14"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold leading-tight">
                          {user.displayName}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">@{user.userName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {getSubtitle(user)}
                        </p>
                      </div>
                    </button>
                  }
                />

                <Button
                  type="button"
                  size="sm"
                  variant={requestSent || user.isFriend ? "outline" : "default"}
                  disabled={requestSent || user.isFriend}
                  className={
                    requestSent || user.isFriend
                      ? "shrink-0 rounded-xl px-4"
                      : "shrink-0 rounded-xl bg-gradient-chat px-4 text-white hover:opacity-90"
                  }
                  onClick={() => void handleAddFriend(user)}
                >
                  {requestSent || user.isFriend ? null : <UserPlus className="size-4" />}
                  {buttonLabel}
                </Button>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default UserSuggestionsList;
