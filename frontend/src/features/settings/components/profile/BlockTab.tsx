import { useState } from "react";
import { getErrorMeta, logger } from "@/shared/lib/logger";
import { ShieldBan, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Separator } from "@/shared/ui/separator";
import { userService } from "@/features/settings/services/userService";
import type { BlockedUser } from "@/shared/types/user";

import SuggestUserInput, { type FriendItem } from "@/features/settings/components/profile/SuggestUserInput";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

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
      toast.error("Người dùng này đã bị chặn rồi.");
      return;
    }

    void (async () => {
      try {
        setIsSubmitting(true);
        const next = await userService.blockUser(
          selectedFriendId,
          blockReason.trim() || undefined,
        );
        setBlocked(next);
        toast.success(`Đã chặn @${userName}`);
        setBlockUserName("");
        setBlockReason("");
      } catch (error) {
        logger.error("Loi chan nguoi dung", getErrorMeta(error));
        toast.error("Không thể chặn người dùng lúc này.");
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  const handleUnblock = (user: BlockedUser) => {
    void (async () => {
      try {
        setBusyUserId(user._id);
        const next = await userService.unblockUser(user._id);
        setBlocked(next);
        toast.success(`Đã bỏ chặn @${user.userName}`);
      } catch (error) {
        logger.error("Loi bo chan nguoi dung", getErrorMeta(error));
        toast.error("Không thể bỏ chặn người dùng lúc này.");
      } finally {
        setBusyUserId(null);
      }
    })();
  };

  const handleClearAllBlocked = () => {
    if (blocked.length === 0) {
      return;
    }

    void (async () => {
      try {
        setIsClearingAll(true);
        let next = blocked;

        for (const user of blocked) {
          next = await userService.unblockUser(user._id);
        }

        setBlocked(next);
        toast.message("Đã xóa danh sách chặn");
      } catch (error) {
        logger.error("Loi xoa toan bo danh sach chan", getErrorMeta(error));
        toast.error("Không thể xóa toàn bộ danh sách chặn lúc này.");
      } finally {
        setIsClearingAll(false);
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
            disabled={isSubmitting}
          />
        </div>

        <Button
          className="w-full"
          variant="destructive"
          onClick={handleBlock}
          disabled={isSubmitting || isClearingAll}
        >
          <ShieldBan className="mr-2 h-4 w-4" />
          {isSubmitting ? "Đang chặn..." : "Chặn"}
        </Button>
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">
          Danh sách đã chặn <Badge variant="secondary">{blocked.length}</Badge>
        </p>

        <Button
          variant="outline"
          className="glass-light border-border/30"
          onClick={handleClearAllBlocked}
          disabled={blocked.length === 0 || isClearingAll || isSubmitting}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {isClearingAll ? "Đang xóa..." : "Xóa hết"}
        </Button>
      </div>

      {blocked.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có ai bị chặn.</p>
      ) : (
        <div className="max-h-52 space-y-2 overflow-auto pr-1">
          {blocked.map((user) => (
            <div
              key={user._id}
              className="glass-light flex items-center justify-between gap-3 rounded-lg border border-border/30 p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">@{user.userName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.displayName}
                </p>
                {user.reason && (
                  <p className="truncate text-xs text-muted-foreground">
                    Lý do: {user.reason}
                  </p>
                )}
              </div>

              <Button
                variant="outline"
                className="glass-light border-border/30"
                onClick={() => handleUnblock(user)}
                disabled={isClearingAll || busyUserId === user._id}
              >
                {busyUserId === user._id ? "Đang bỏ chặn..." : "Bỏ chặn"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BlockTab;
