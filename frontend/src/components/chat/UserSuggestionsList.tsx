import { useMemo, useState, useCallback, useRef } from "react";
import { RotateCw, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/chat/UserAvatar";
import { getErrorMeta, logger } from "@/lib/logger";
import { useFriendStore } from "@/stores/useFriendStore";
import type { DiscoverUser } from "@/types/user";
import DirectProfileDialog from "./DirectProfileDialog";

interface SuggestionListUser extends DiscoverUser {
  sentRequestId?: string;
  canRenderAction: boolean;
}

interface UserSuggestionsListProps {
  users: DiscoverUser[];
  title?: string;
  emptyText?: string;
  loading?: boolean;
  compact?: boolean;
  onRefresh?: () => Promise<void>;
}

const getSubtitle = (user: DiscoverUser) => {
  if (user.reasonText?.trim()) {
    return user.reasonText;
  }

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
  const { addFriend, cancelSentRequest, friends, sentList, receivedList } = useFriendStore();
  const [submittingIds, setSubmittingIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastRefreshTimeRef = useRef<number>(0);
  const REFRESH_DEBOUNCE_MS = 500;

  const friendIds = useMemo(
    () => new Set(friends.map((friend) => friend._id)),
    [friends],
  );
  const sentRequestIds = useMemo(
    () => new Set(sentList.map((request) => request.to?._id).filter(Boolean)),
    [sentList],
  );
  const sentRequestMap = useMemo(
    () =>
      new Map(
        sentList
          .filter((request) => request._id && request.to?._id)
          .map((request) => [request.to!._id, request._id]),
      ),
    [sentList],
  );
  const receivedRequestIds = useMemo(
    () => new Set(receivedList.map((request) => request.from?._id).filter(Boolean)),
    [receivedList],
  );

  const mergedUsers = useMemo<SuggestionListUser[]>(
    () =>
      users.map((user) => {
        const isFriend = user.isFriend || friendIds.has(user._id);
        const requestSent = user.requestSent || sentRequestIds.has(user._id);
        const requestReceived = !requestSent && (user.requestReceived || receivedRequestIds.has(user._id));
        const canSendFriendRequest =
          typeof user.canSendFriendRequest === "boolean" ? user.canSendFriendRequest : true;
        const canRenderAction = isFriend || requestSent || canSendFriendRequest;

        return {
          ...user,
          isFriend,
          requestSent,
          requestReceived,
          canSendFriendRequest,
          canRenderAction,
          sentRequestId: sentRequestMap.get(user._id),
        };
      }),
    [friendIds, receivedRequestIds, sentRequestIds, sentRequestMap, users],
  );

  const handleAddFriend = async (user: SuggestionListUser) => {
    if (
      user.requestSent ||
      user.isFriend ||
      submittingIds.includes(user._id) ||
      user.canSendFriendRequest === false
    ) {
      return;
    }

    setSubmittingIds((current) => [...current, user._id]);

    try {
      const result = await addFriend(user._id);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } finally {
      setSubmittingIds((current) =>
        current.filter((pendingUserId) => pendingUserId !== user._id),
      );
    }
  };

  const handleCancelRequest = async (user: SuggestionListUser) => {
    if (!user.sentRequestId || submittingIds.includes(user._id)) {
      return;
    }

    setSubmittingIds((current) => [...current, user._id]);

    try {
      await cancelSentRequest(user.sentRequestId, user._id);
      toast.success("Đã hủy lời mời kết bạn");
    } catch (error) {
      logger.error("Khong the huy loi moi ket ban tu danh sach goi y", getErrorMeta(error));
      toast.error("Không thể hủy lời mời kết bạn");
    } finally {
      setSubmittingIds((current) => current.filter((currentUserId) => currentUserId !== user._id));
    }
  };

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || !onRefresh) return;

    const now = Date.now();
    if (now - lastRefreshTimeRef.current < REFRESH_DEBOUNCE_MS) {
      return;
    }
    lastRefreshTimeRef.current = now;

    setIsRefreshing(true);
    try {
      await onRefresh();
      toast.success("Đã làm mới gợi ý");
    } catch (error) {
      logger.error("Khong the lam moi danh sach goi y", getErrorMeta(error));
      toast.error("Không thể làm mới gợi ý");
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, onRefresh]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h3>
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            className="rounded-md p-1.5 transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            title="Làm mới gợi ý"
          >
            <RotateCw
              className={`size-4 text-muted-foreground ${
                isRefreshing || loading ? "animate-spin" : ""
              }`}
            />
          </button>
        ) : null}
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
            const isSubmitting = submittingIds.includes(user._id);
            const buttonLabel = user.isFriend
              ? "Bạn bè"
              : user.requestSent
                ? "Hủy lời mời"
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

                {user.canRenderAction ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={user.requestSent || user.isFriend ? "outline" : "default"}
                    disabled={user.isFriend || isSubmitting}
                    className={
                      user.requestSent || user.isFriend
                        ? "shrink-0 rounded-xl"
                        : "shrink-0 rounded-xl bg-gradient-chat text-white hover:opacity-90"
                    }
                    onClick={() =>
                      user.requestSent
                        ? void handleCancelRequest(user)
                        : void handleAddFriend(user)
                    }
                  >
                    {!user.requestSent && !user.isFriend ? <UserPlus className="size-4" /> : null}
                    {isSubmitting
                      ? user.requestSent
                        ? "Đang hủy..."
                        : "Đang gửi..."
                      : buttonLabel}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default UserSuggestionsList;
