import { useEffect, useCallback, useRef } from "react";
import { MessageCircle, Users } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import { useSuggestionStore } from "@/stores/useSuggestionStore";
import { Card } from "../ui/card";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import UserAvatar from "../chat/UserAvatar";
import UserSuggestionsList from "../chat/UserSuggestionsList";

type Friend = {
  _id: string;
  displayName: string;
  userName: string;
  avatarUrl?: string;
};

interface FriendListModalProps {
  open?: boolean;
  friends?: Friend[];
  loading?: boolean;
  onPick?: () => void;
}

const FriendListModal = ({
  open = false,
  friends: friendsProp,
  loading: loadingProp,
  onPick,
}: FriendListModalProps) => {
  const currentUserId = useAuthStore((state) => state.user?._id);
  const { friends: friendsStore, loading: loadingStore } = useFriendStore();
  const {
    suggestions,
    isFetching,
    hasFetched,
    fetchSuggestions,
    refreshSuggestions,
  } = useSuggestionStore();
  const { createConversation } = useChatStore();

  const modalOpenedRef = useRef(false);
  const effectRunRef = useRef(false);

  const friends = friendsProp ?? friendsStore;
  const loading = loadingProp ?? loadingStore;
  const shouldShowSuggestions = !loading && (!friends || friends.length === 0);

  useEffect(() => {
    if (!open) {
      modalOpenedRef.current = false;
      effectRunRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !currentUserId || !shouldShowSuggestions) {
      return;
    }

    if (effectRunRef.current) {
      return;
    }
    effectRunRef.current = true;

    if (!modalOpenedRef.current) {
      modalOpenedRef.current = true;

      if (!hasFetched) {
        void fetchSuggestions(5, false);
      }
    }
  }, [
    open,
    currentUserId,
    shouldShowSuggestions,
    hasFetched,
    fetchSuggestions,
  ]);

  const handleAddConversation = async (friendId: string) => {
    await createConversation("direct", "", [friendId]);
    onPick?.();
  };

  const handleRefreshSuggestions = useCallback(async () => {
    await refreshSuggestions(5);
  }, [refreshSuggestions]);

  return (
    <DialogContent className="glass max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl capitalize">
          <MessageCircle className="size-5" />
          Bắt đầu cuộc trò chuyện mới
        </DialogTitle>
        <DialogDescription className="sr-only">
          Chọn một người bạn để bắt đầu cuộc trò chuyện trực tiếp hoặc xem các
          gợi ý kết bạn.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <div className="space-y-2">
          <h1 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Danh sách bạn bè
          </h1>

          <div className="max-h-60 space-y-2 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                Đang tải danh sách bạn bè...
              </div>
            ) : null}

            {!loading &&
              friends?.map((friend) => (
                <Card
                  key={friend._id}
                  onClick={() => void handleAddConversation(friend._id)}
                  className="group/friendCard cursor-pointer p-3 transition-smooth hover:bg-muted/30 hover:shadow-soft"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      type="sidebar"
                      name={friend.displayName}
                      avatarUrl={friend.avatarUrl}
                    />

                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-semibold">
                        {friend.displayName}
                      </h2>
                      <span className="text-sm text-muted-foreground">
                        @{friend.userName}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}

            {shouldShowSuggestions ? (
              <div className="py-2 text-center text-muted-foreground">
                <Users className="mx-auto mb-3 size-12 opacity-50" />
                Chưa có bạn bè nào. Bạn có thể gửi lời mời từ các gợi ý bên
                dưới.
              </div>
            ) : null}
          </div>
        </div>

        {shouldShowSuggestions ? (
          <UserSuggestionsList
            users={suggestions}
            loading={Boolean(currentUserId) && isFetching}
            compact
            title="Bạn có thể biết"
            emptyText="Chưa có gợi ý phù hợp để bắt đầu."
            onRefresh={handleRefreshSuggestions}
          />
        ) : null}
      </div>
    </DialogContent>
  );
};

export default FriendListModal;
