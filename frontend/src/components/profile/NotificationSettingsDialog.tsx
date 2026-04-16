import { useMemo, useState } from "react";
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
  messageNotification: boolean;
  messageSound: boolean;
  friendRequestNotification: boolean;
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

const getStoredSettings = (): NotificationSetting => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
};

const NotificationSettingsDialog = ({ open, setOpen }: Props) => {
  const [settings, setSettings] = useState<NotificationSetting>(getStoredSettings);

  const isDisabledAll = useMemo(() => !settings.enableAll, [settings.enableAll]);

  const toggle = (key: keyof NotificationSetting, val: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      toast.success("Da luu cai dat thong bao");
      setOpen(false);
    } catch {
      toast.error("Luu that bai. Thu lai.");
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    toast.message("Da reset ve mac dinh");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="glass-strong border-border/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Cai dat thong bao
          </DialogTitle>
          <DialogDescription>Bat/tat thong bao theo nhu cau cua ban</DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div className="glass-light flex items-center justify-between rounded-lg border border-border/30 p-3">
            <div>
              <p className="font-medium">Bat tat ca thong bao</p>
              <p className="text-xs text-muted-foreground">
                Tat muc nay se tat toan bo thong bao phia duoi
              </p>
            </div>
            <Switch
              checked={settings.enableAll}
              onCheckedChange={(v) => toggle("enableAll", v)}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-semibold">Tin nhan</p>

            <div className="glass-light flex items-center justify-between rounded-lg border border-border/30 p-3">
              <div>
                <p className="font-medium">Thong bao tin nhan</p>
                <p className="text-xs text-muted-foreground">Hien popup khi co tin nhan moi</p>
              </div>
              <Switch
                checked={settings.messageNotification}
                onCheckedChange={(v) => toggle("messageNotification", v)}
                disabled={isDisabledAll}
              />
            </div>

            <div className="glass-light flex items-center justify-between rounded-lg border border-border/30 p-3">
              <div>
                <p className="font-medium">Am thanh tin nhan</p>
                <p className="text-xs text-muted-foreground">Phat am thanh khi nhan tin nhan</p>
              </div>
              <Switch
                checked={settings.messageSound}
                onCheckedChange={(v) => toggle("messageSound", v)}
                disabled={isDisabledAll || !settings.messageNotification}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Ket ban</p>

            <div className="glass-light flex items-center justify-between rounded-lg border border-border/30 p-3">
              <div>
                <p className="font-medium">Loi moi ket ban</p>
                <p className="text-xs text-muted-foreground">Thong bao khi co request moi</p>
              </div>
              <Switch
                checked={settings.friendRequestNotification}
                onCheckedChange={(v) => toggle("friendRequestNotification", v)}
                disabled={isDisabledAll}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">He thong</p>

            <div className="glass-light flex items-center justify-between rounded-lg border border-border/30 p-3">
              <div>
                <p className="font-medium">Thong bao he thong</p>
                <p className="text-xs text-muted-foreground">Bao tri, cap nhat, canh bao bao mat...</p>
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
              className="glass-light flex-1 border-border/30"
              onClick={handleReset}
            >
              Reset
            </Button>

            <Button className="flex-1 bg-gradient-primary" onClick={handleSave}>
              Luu cai dat
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettingsDialog;
