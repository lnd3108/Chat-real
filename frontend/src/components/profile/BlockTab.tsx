import { ShieldBan, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { userService } from "@/services/userService";
import type { BlockedUser } from "@/types/user";

import SuggestUserInput, { type FriendItem } from "./SuggestUserInput";

type Props = {
  friends: FriendItem[];
  blocked: BlockedUser[];
  setBlocked: (next: BlockedUser[]) => void;
  blockUserName: string;
  setBlockUserName: (v: string) => void;
  blockReason: string;
  setBlockReason: (v: string) => void;
};

const BlockTab = ({
  friends,
  blocked,
  setBlocked,
  blockUserName,
  setBlockUserName,
  blockReason,
  setBlockReason,
}: Props) => {
  const selectedFriend = friends.find(
    (friend) => friend.userName.toLowerCase() === blockUserName.trim().toLowerCase(),
  );

  const isBlocked = () => {
    const userName = blockUserName.trim().toLowerCase();
    if (!userName) return false;
    return blocked.some((item) => item.userName.toLowerCase() === userName);
  };

  const handleBlock = () => {
    const userName = blockUserName.trim();
    const selectedFriendId = selectedFriend?._id;
    if (!userName) {
      toast.error("Nhập username cần chặn.");
      return;
    }

    if (!selectedFriendId) {
      toast.error("Chỉ hỗ trợ chặn từ danh sách bạn bè hiện có.");
      return;
    }

    if (isBlocked()) {
      toast.error("User này đã bị chặn rồi.");
      return;
    }

    void (async () => {
      try {
        const next = await userService.blockUser(
          selectedFriendId,
          blockReason.trim() || undefined,
        );
        setBlocked(next);
        toast.success(`Đã chặn @${userName}`);
        setBlockUserName("");
        setBlockReason("");
      } catch (error) {
        console.error("Lỗi chặn người dùng:", error);
        toast.error("Không thể chặn người dùng lúc này.");
      }
    })();
  };

  const handleUnblock = (user: BlockedUser) => {
    void (async () => {
      try {
        const next = await userService.unblockUser(user._id);
        setBlocked(next);
        toast.success(`Đã bỏ chặn @${user.userName}`);
      } catch (error) {
        console.error("Lỗi bỏ chặn người dùng:", error);
        toast.error("Không thể bỏ chặn người dùng lúc này.");
      }
    })();
  };

  const handleClearAllBlocked = () => {
    void (async () => {
      try {
        let next = blocked;
        for (const user of blocked) {
          next = await userService.unblockUser(user._id);
        }
        setBlocked(next);
        toast.message("Đã xóa danh sách chặn");
      } catch (error) {
        console.error("Lỗi xóa toàn bộ danh sách chặn:", error);
        toast.error("Không thể xóa toàn bộ danh sách chặn lúc này.");
      }
    })();
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="space-y-3">
        <SuggestUserInput
          label="Chặn username"
          value={blockUserName}
          setValue={setBlockUserName}
          placeholder="Ví dụ: vanhle"
          friends={friends}
        />

        <div className="space-y-2">
          <Label>Lý do (tùy chọn)</Label>
          <Input
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Spam / làm phiền..."
            className="glass-light border-border/30"
          />
        </div>

        <Button className="w-full" variant="destructive" onClick={handleBlock}>
          <ShieldBan className="mr-2 h-4 w-4" />
          Chặn
        </Button>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <p className="font-medium">
          Danh sách đã chặn <Badge variant="secondary">{blocked.length}</Badge>
        </p>

        <Button
          variant="outline"
          className="glass-light border-border/30"
          onClick={handleClearAllBlocked}
          disabled={blocked.length === 0}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Xoá hết
        </Button>
      </div>

      {blocked.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có ai bị chặn.</p>
      ) : (
        <div className="max-h-52 space-y-2 overflow-auto pr-1">
          {blocked.map((user) => (
            <div
              key={user._id}
              className="glass-light flex items-center justify-between rounded-lg border border-border/30 p-3"
            >
              <div>
                <p className="font-medium">@{user.userName}</p>
                <p className="text-xs text-muted-foreground">
                  {user.displayName}
                </p>
                {user.reason && (
                  <p className="text-xs text-muted-foreground">Lý do: {user.reason}</p>
                )}
              </div>

              <Button
                variant="outline"
                className="glass-light border-border/30"
                onClick={() => handleUnblock(user)}
              >
                Bỏ chặn
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BlockTab;
