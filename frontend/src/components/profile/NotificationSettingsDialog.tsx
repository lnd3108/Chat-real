import { useEffect, useMemo, useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  areAllSoundsEnabled,
  defaultNotificationSettings,
  getNotificationSettings,
  saveNotificationSettings,
  subscribeNotificationSettings,
  type NotificationSetting,
} from "@/lib/messageNotifications";

type Props = {
  open: boolean;
  setOpen: (val: boolean) => void;
};

const NotificationSettingsDialog = ({ open, setOpen }: Props) => {
  const [settings, setSettings] = useState<NotificationSetting>(getNotificationSettings);

  useEffect(() => subscribeNotificationSettings(setSettings), []);

  const isDisabledAll = useMemo(() => !settings.enableAll, [settings.enableAll]);
  const allSoundsEnabled = useMemo(() => areAllSoundsEnabled(settings), [settings]);

  const toggle = (key: keyof NotificationSetting, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleAllSounds = (enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      soundEnabled: enabled,
      messageSound: enabled,
      typingSound: enabled,
      clickSound: enabled,
    }));
  };

  const handleSave = () => {
    try {
      saveNotificationSettings(settings);
      toast.success("Đã lưu cài đặt thông báo");
      setOpen(false);
    } catch {
      toast.error("Lưu thất bại. Thử lại.");
    }
  };

  const handleReset = () => {
    setSettings(defaultNotificationSettings);
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
            Bật hoặc tắt thông báo và âm thanh theo nhu cầu của bạn
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div className="glass-light flex items-center justify-between rounded-lg border border-border/30 p-3">
            <div>
              <p className="font-medium">Bật tất cả thông báo</p>
              <p className="text-xs text-muted-foreground">
                Tắt mục này sẽ tắt toàn bộ các mục bên dưới
              </p>
            </div>
            <Switch
              checked={settings.enableAll}
              onCheckedChange={(value) => toggle("enableAll", value)}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-semibold">Tin nhắn</p>

            <div className="glass-light flex items-center justify-between rounded-lg border border-border/30 p-3">
              <div>
                <p className="font-medium">Thông báo tin nhắn</p>
                <p className="text-xs text-muted-foreground">
                  Hiện thông báo khi có tin nhắn mới
                </p>
              </div>
              <Switch
                checked={settings.messageNotification}
                onCheckedChange={(value) => toggle("messageNotification", value)}
                disabled={isDisabledAll}
              />
            </div>

            <div className="glass-light flex items-center justify-between rounded-lg border border-border/30 p-3">
              <div>
                <p className="font-medium">Âm thanh thông báo tin nhắn</p>
                <p className="text-xs text-muted-foreground">
                  Chỉ phát khi thông báo tin nhắn đang được bật
                </p>
              </div>
              <Switch
                checked={settings.messageSound}
                onCheckedChange={(value) => toggle("messageSound", value)}
                disabled={isDisabledAll || !settings.messageNotification}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Âm thanh</p>

            <div className="glass-light flex items-center justify-between rounded-lg border border-border/30 p-3">
              <div>
                <p className="font-medium">Bật tất cả âm thanh</p>
                <p className="text-xs text-muted-foreground">
                  Khi tắt, toàn bộ âm thanh trong hệ thống sẽ bị tắt
                </p>
              </div>
              <Switch
                checked={allSoundsEnabled}
                onCheckedChange={toggleAllSounds}
                disabled={isDisabledAll}
              />
            </div>

            <div className="glass-light flex items-center justify-between rounded-lg border border-border/30 p-3">
              <div>
                <p className="font-medium">Âm thanh khi gõ</p>
                <p className="text-xs text-muted-foreground">
                  Phát âm thanh nhẹ khi gõ tin nhắn trong ô chat
                </p>
              </div>
              <Switch
                checked={settings.typingSound}
                onCheckedChange={(value) => toggle("typingSound", value)}
                disabled={isDisabledAll}
              />
            </div>

            <div className="glass-light flex items-center justify-between rounded-lg border border-border/30 p-3">
              <div>
                <p className="font-medium">Âm thanh click</p>
                <p className="text-xs text-muted-foreground">
                  Phát âm thanh cho các thao tác click trên màn hình chat
                </p>
              </div>
              <Switch
                checked={settings.clickSound}
                onCheckedChange={(value) => toggle("clickSound", value)}
                disabled={isDisabledAll}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Kết bạn</p>

            <div className="glass-light flex items-center justify-between rounded-lg border border-border/30 p-3">
              <div>
                <p className="font-medium">Lời mời kết bạn</p>
                <p className="text-xs text-muted-foreground">
                  Thông báo khi có request mới
                </p>
              </div>
              <Switch
                checked={settings.friendRequestNotification}
                onCheckedChange={(value) => toggle("friendRequestNotification", value)}
                disabled={isDisabledAll}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Hệ thống</p>

            <div className="glass-light flex items-center justify-between rounded-lg border border-border/30 p-3">
              <div>
                <p className="font-medium">Thông báo hệ thống</p>
                <p className="text-xs text-muted-foreground">
                  Bảo trì, cập nhật, cảnh báo bảo mật
                </p>
              </div>
              <Switch
                checked={settings.systemNotification}
                onCheckedChange={(value) => toggle("systemNotification", value)}
                disabled={isDisabledAll}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="glass-light flex-1 border-border/30"
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
