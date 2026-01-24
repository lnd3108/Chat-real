import { useEffect, useMemo, useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

type Props = {
  open: boolean;
  setOpen: (val: boolean) => void;
};

type NotificationSetting = {
  enableAll: boolean;

  // message
  messageNotification: boolean;
  messageSound: boolean;

  // friend request
  friendRequestNotification: boolean;

  // system
  systemNotification: boolean;
};

const STORAGE_KEY = "chat_notification_settings";

const defaultSettings: NotificationSetting = {
  enableAll: true,

  messageNotification: true,
  messageSound: true,

  friendRequestNotification: true,

  systemNotification: true,
};

const NotificationSettingsDialog = ({ open, setOpen }: Props) => {
  const [settings, setSettings] =
    useState<NotificationSetting>(defaultSettings);

  // load settings when open
  useEffect(() => {
    if (!open) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSettings(JSON.parse(raw));
      } else {
        setSettings(defaultSettings);
      }
    } catch {
      setSettings(defaultSettings);
    }
  }, [open]);

  const isDisabledAll = useMemo(() => !settings.enableAll, [settings.enableAll]);

  const toggle = (key: keyof NotificationSetting, val: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      toast.success("Đã lưu cài đặt thông báo ✅");
      setOpen(false);
    } catch {
      toast.error("Lưu thất bại! thử lại nhé.");
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    toast.message("Đã reset về mặc định");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="glass-strong border-border/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Cài đặt thông báo
          </DialogTitle>
          <DialogDescription>
            Bật/tắt thông báo theo nhu cầu của bạn
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Enable all */}
          <div className="flex items-center justify-between rounded-lg border border-border/30 p-3 glass-light">
            <div>
              <p className="font-medium">Bật tất cả thông báo</p>
              <p className="text-xs text-muted-foreground">
                Tắt mục này sẽ tắt toàn bộ thông báo phía dưới
              </p>
            </div>
            <Switch
              checked={settings.enableAll}
              onCheckedChange={(v) => toggle("enableAll", v)}
            />
          </div>

          <Separator />

          {/* Message */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Tin nhắn</p>

            <div className="flex items-center justify-between rounded-lg border border-border/30 p-3 glass-light">
              <div>
                <p className="font-medium">Thông báo tin nhắn</p>
                <p className="text-xs text-muted-foreground">
                  Hiện popup khi có tin nhắn mới
                </p>
              </div>
              <Switch
                checked={settings.messageNotification}
                onCheckedChange={(v) => toggle("messageNotification", v)}
                disabled={isDisabledAll}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/30 p-3 glass-light">
              <div>
                <p className="font-medium">Âm thanh tin nhắn</p>
                <p className="text-xs text-muted-foreground">
                  Phát âm thanh khi nhận tin nhắn
                </p>
              </div>
              <Switch
                checked={settings.messageSound}
                onCheckedChange={(v) => toggle("messageSound", v)}
                disabled={isDisabledAll || !settings.messageNotification}
              />
            </div>
          </div>

          {/* Friend request */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Kết bạn</p>

            <div className="flex items-center justify-between rounded-lg border border-border/30 p-3 glass-light">
              <div>
                <p className="font-medium">Lời mời kết bạn</p>
                <p className="text-xs text-muted-foreground">
                  Thông báo khi có request mới
                </p>
              </div>
              <Switch
                checked={settings.friendRequestNotification}
                onCheckedChange={(v) => toggle("friendRequestNotification", v)}
                disabled={isDisabledAll}
              />
            </div>
          </div>

          {/* System */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Hệ thống</p>

            <div className="flex items-center justify-between rounded-lg border border-border/30 p-3 glass-light">
              <div>
                <p className="font-medium">Thông báo hệ thống</p>
                <p className="text-xs text-muted-foreground">
                  Bảo trì, cập nhật, cảnh báo bảo mật...
                </p>
              </div>
              <Switch
                checked={settings.systemNotification}
                onCheckedChange={(v) => toggle("systemNotification", v)}
                disabled={isDisabledAll}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 glass-light border-border/30"
              onClick={handleReset}
            >
              Reset
            </Button>

            <Button className="flex-1 bg-gradient-primary" onClick={handleSave}>
              Lưu cài đặt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettingsDialog;
