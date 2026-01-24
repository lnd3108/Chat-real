import { ShieldBan, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import SuggestUserInput, { type FriendItem } from "./SuggestUserInput";

export type BlockedUser = {
  userName: string;
  reason?: string;
  createdAt: string;
};

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
  const isBlocked = () => {
    const u = blockUserName.trim().toLowerCase();
    if (!u) return false;
    return blocked.some((b) => b.userName.toLowerCase() === u);
  };

  const handleBlock = () => {
    const u = blockUserName.trim();
    if (!u) {
      toast.error("Nhập username cần chặn.");
      return;
    }
    if (isBlocked()) {
      toast.error("User này đã bị chặn rồi.");
      return;
    }

    const next: BlockedUser[] = [
      ...blocked,
      {
        userName: u,
        reason: blockReason.trim() || undefined,
        createdAt: new Date().toISOString(),
      },
    ];

    setBlocked(next);
    toast.success(`Đã chặn @${u}`);
    setBlockUserName("");
    setBlockReason("");
  };

  const handleUnblock = (userName: string) => {
    const next = blocked.filter((b) => b.userName !== userName);
    setBlocked(next);
    toast.success(`Đã bỏ chặn @${userName}`);
  };

  const handleClearAllBlocked = () => {
    setBlocked([]);
    toast.message("Đã xoá danh sách chặn");
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
          <Label>Lý do (tuỳ chọn)</Label>
          <Input
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Spam / làm phiền..."
            className="glass-light border-border/30"
          />
        </div>

        <Button className="w-full" variant="destructive" onClick={handleBlock}>
          <ShieldBan className="h-4 w-4 mr-2" />
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
          <Trash2 className="h-4 w-4 mr-2" />
          Xoá hết
        </Button>
      </div>

      {blocked.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có ai bị chặn.</p>
      ) : (
        <div className="space-y-2 max-h-52 overflow-auto pr-1">
          {blocked.map((u) => (
            <div
              key={u.userName}
              className="flex items-center justify-between rounded-lg border border-border/30 p-3 glass-light"
            >
              <div>
                <p className="font-medium">@{u.userName}</p>
                {u.reason && (
                  <p className="text-xs text-muted-foreground">
                    Lý do: {u.reason}
                  </p>
                )}
              </div>

              <Button
                variant="outline"
                className="glass-light border-border/30"
                onClick={() => handleUnblock(u.userName)}
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
