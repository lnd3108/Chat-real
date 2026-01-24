import { MessageCircle, Users } from "lucide-react";

import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";

import { DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Card } from "../ui/card";
import UserAvatar from "../chat/UserAvatar";

type Friend = {
  _id: string;
  displayName: string;
  userName: string;
  avatarUrl?: string;
};

interface FriendListModalProps {
  friends?: Friend[];
  loading?: boolean;
  onPick?: () => void;
}

const FriendListModal = ({
  friends: friendsProp,
  loading: loadingProp,
  onPick,
}: FriendListModalProps) => {
  const { friends: friendsStore, loading: loadingStore } = useFriendStore();
  const { createConversation } = useChatStore();

  const friends = friendsProp ?? friendsStore;
  const loading = loadingProp ?? loadingStore;

  const handleAddConversation = async (friendId: string) => {
    const convo = await createConversation("direct", "", [friendId]);

    // convo đã fetchMessages bên store rồi -> đóng dialog
    onPick?.();
  };

  return (
    <DialogContent className="glass max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl capitalize">
          <MessageCircle className="size-5" />
          Bắt đầu hội thoại mới
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <h1 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Danh sách bạn bè
        </h1>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {/* Loading */}
          {loading && (
            <div className="text-center py-8 text-muted-foreground">
              Đang tải danh sách bạn bè...
            </div>
          )}

          {/* List */}
          {!loading &&
            friends?.map((friend) => (
              <Card
                key={friend._id}
                onClick={() => handleAddConversation(friend._id)}
                className="p-3 cursor-pointer transition-smooth hover:shadow-soft glass hover:bg-muted/30 group/friendCard"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar
                    type="sidebar"
                    name={friend.displayName}
                    avatarUrl={friend.avatarUrl}
                  />

                  <div className="flex-1 min-w-0 flex flex-col">
                    <h2 className="font-semibold text-sm truncate">
                      {friend.displayName}
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      @{friend.userName}
                    </span>
                  </div>
                </div>
              </Card>
            ))}

          {/* Empty */}
          {!loading && (!friends || friends.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="size-12 mx-auto mb-3 opacity-50" />
              Chưa có bạn bè nào. Hãy thêm bạn bè để bắt đầu trò chuyện!
            </div>
          )}
        </div>
      </div>
    </DialogContent>
  );
};

export default FriendListModal;
