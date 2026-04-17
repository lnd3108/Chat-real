import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

import type { Conversation } from "@/types/chat";
import {
  isGroupNotificationEnabled,
  setGroupNotificationEnabled,
} from "@/lib/groupNotificationSettings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Switch } from "../ui/switch";

interface GroupNotificationSettingsDialogProps {
  chat: Conversation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GroupNotificationSettingsDialog = ({
  chat,
  open,
  onOpenChange,
}: GroupNotificationSettingsDialogProps) => {
  const [enabled, setEnabled] = useState(() => isGroupNotificationEnabled(chat._id));

  useEffect(() => {
    if (!open) return;
    setEnabled(isGroupNotificationEnabled(chat._id));
  }, [chat._id, open]);

  const handleToggle = (nextValue: boolean) => {
    setEnabled(nextValue);
    setGroupNotificationEnabled(chat._id, nextValue);
    toast.success(nextValue ? "Đã bật thông báo cho nhóm" : "Đã tắt thông báo cho nhóm");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            Cài đặt thông báo nhóm
          </DialogTitle>
          <DialogDescription>
            Bật hoặc tắt thông báo riêng cho nhóm {chat.group?.name ?? "này"}.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Thông báo nhóm</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Khi tắt, nhóm này sẽ không hiện popup thông báo tin nhắn mới.
              </p>
            </div>

            <Switch checked={enabled} onCheckedChange={handleToggle} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupNotificationSettingsDialog;
