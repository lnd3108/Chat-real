import { useMemo, useState } from "react";
import { UserPlus, Users, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  onRefresh?: () => Promise<void>;
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
  onRefresh,
}: UserSuggestionsListProps) => {
  const { addFriend, friends, sentList, receivedList } = useFriendStore();
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const friendIds = useMemo(
    () => new Set(friends.map((friend) => friend._id)),
    [friends],
  );
  const sentRequestIds = useMemo(
    () => new Set(sentList.map((request) => request.to?._id).filter(Boolean)),
    [sentList],
  );
  const receivedRequestIds = useMemo(
    () => new Set(receivedList.map((request) => request.from?._id).filter(Boolean)),
    [receivedList],
  );

  const mergedUsers = useMemo(
    () =>
      users.map((user) => {
        const isFriend = user.isFriend || friendIds.has(user._id);
        const requestSent =
          user.requestSent || pendingIds.includes(user._id) || sentRequestIds.has(user._id);
        const requestReceived = user.requestReceived || receivedRequestIds.has(user._id);

        return {
          ...user,
          isFriend,
          requestSent,
          requestReceived: requestSent ? false : requestReceived,
        };
      }),
    [friendIds, pendingIds, receivedRequestIds, sentRequestIds, users],
  );

  const handleAddFriend = async (user: DiscoverUser) => {
    if (user.requestSent || user.isFriend || pendingIds.includes(user._id)) {
      return;
    }

    setPendingIds((current) => [...current, user._id]);

    try {
      const result = await addFriend(user._id);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } finally {
      setPendingIds((current) =>
        current.filter((pendingUserId) => pendingUserId !== user._id),
      );
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh();
      toast.success("Đã làm mới gợi ý");
    } catch (error) {
      console.error("Failed to refresh suggestions:", error);
      toast.error("Không thể làm mới gợi ý");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h3>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            className="rounded-md p-1.5 transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            title="Làm mới gợi ý"
          >
            <RotateCw className={`size-4 text-muted-foreground ${isRefreshing || loading ? 'animate-spin' : ''}`} />
          </button>
        )}
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
        <div className="space-y-2">
          {mergedUsers.map((user) => {
            const requestSent = user.requestSent || pendingIds.includes(user._id);
            const buttonLabel = user.isFriend
              ? "Bạn bè"
              : requestSent
                ? "Đã gửi"
                : user.requestReceived
                  ? "Phản hồi"
                  : "Kết bạn";

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
          })}
        </div>
      ) : null}
    </div>
  );
};

export default UserSuggestionsList;
