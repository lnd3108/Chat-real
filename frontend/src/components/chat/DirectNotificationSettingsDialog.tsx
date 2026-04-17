import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

import type { Conversation } from "@/types/chat";
import {
  isDirectNotificationEnabled,
  setDirectNotificationEnabled,
} from "@/lib/directChatPreferences";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Switch } from "../ui/switch";

interface DirectNotificationSettingsDialogProps {
  chat: Conversation;
  displayName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DirectNotificationSettingsDialog = ({
  chat,
  displayName,
  open,
  onOpenChange,
}: DirectNotificationSettingsDialogProps) => {
  const [enabled, setEnabled] = useState(() => isDirectNotificationEnabled(chat._id));

  const handleToggle = (nextValue: boolean) => {
    setEnabled(nextValue);
    setDirectNotificationEnabled(chat._id, nextValue);
    toast.success(
      nextValue
        ? "Đã bật thông báo cho đoạn chat này"
        : "Đã tắt thông báo cho đoạn chat này",
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            Cài đặt thông báo
          </DialogTitle>
          <DialogDescription>
            Bật hoặc tắt thông báo riêng cho cuộc trò chuyện với{" "}
            {displayName || "người dùng này"}.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Thông báo direct chat</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Khi tắt, cuộc trò chuyện này sẽ không hiện popup thông báo tin nhắn mới.
              </p>
            </div>

            <Switch checked={enabled} onCheckedChange={handleToggle} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DirectNotificationSettingsDialog;
