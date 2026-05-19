import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellRing,
  Handshake,
  MessageSquare,
  PhoneCall,
  RotateCcw,
  ShieldAlert,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Switch } from "@/shared/ui/switch";
import { cn } from "@/shared/lib/utils";
import {
  areAllSoundsEnabled,
  defaultNotificationSettings,
  getNotificationSettings,
  saveNotificationSettings,
  subscribeNotificationSettings,
  type NotificationSetting,
} from "@/features/notification/lib/messageNotifications";

type Props = {
  open: boolean;
  setOpen: (val: boolean) => void;
};

type NotificationCategory = {
  id: "overview" | "messages" | "calls" | "friends" | "support" | "system";
  label: string;
  icon: typeof Bell;
};

const categories: NotificationCategory[] = [
  { id: "overview", label: "Tổng quan", icon: Bell },
  { id: "messages", label: "Tin nhắn", icon: MessageSquare },
  { id: "calls", label: "Cuộc gọi", icon: PhoneCall },
  { id: "friends", label: "Kết bạn", icon: Handshake },
  { id: "support", label: "Báo cáo / Hỗ trợ", icon: ShieldAlert },
  { id: "system", label: "Hệ thống", icon: BellRing },
];

type NotificationSettingsPanelProps = {
  compact?: boolean;
};

export const NotificationSettingsPanel = ({ compact = false }: NotificationSettingsPanelProps) => {
  const [settings, setSettings] = useState<NotificationSetting>(getNotificationSettings);
  const [category, setCategory] = useState<NotificationCategory["id"]>("overview");

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
    } catch {
      toast.error("Lưu thất bại. Vui lòng thử lại.");
    }
  };

  const handleReset = () => {
    setSettings(defaultNotificationSettings);
    toast.message("Đã đặt lại về mặc định");
  };

  return (
    <div className={cn("space-y-4", compact && "lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-4 lg:space-y-0")}>
      <div className="app-scrollbar-thin flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {categories.map((item) => {
          const Icon = item.icon;
          const active = category === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm shadow-sm transition-all",
                active
                  ? "border-primary/35 bg-white/65 text-foreground ring-1 ring-primary/10 dark:bg-white/[0.08]"
                  : "border-white/40 bg-white/35 text-muted-foreground hover:bg-white/55 hover:text-foreground dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.065]",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="whitespace-nowrap lg:whitespace-normal">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {category === "overview" ? (
          <>
            <SettingRow
              title="Bật tất cả thông báo"
              description="Tắt mục này sẽ tắt toàn bộ thông báo trong ứng dụng."
              checked={settings.enableAll}
              onCheckedChange={(value) => toggle("enableAll", value)}
            />
            <SettingRow
              title="Bật tất cả âm thanh"
              description="Điều khiển toàn bộ âm thanh liên quan đến thông báo."
              checked={allSoundsEnabled}
              onCheckedChange={toggleAllSounds}
              disabled={isDisabledAll}
              icon={Volume2}
            />
          </>
        ) : null}

        {category === "messages" ? (
          <>
            <SettingRow
              title="Thông báo tin nhắn"
              description="Hiển thị thông báo khi có tin nhắn mới."
              checked={settings.messageNotification}
              onCheckedChange={(value) => toggle("messageNotification", value)}
              disabled={isDisabledAll}
            />
            <SettingRow
              title="Âm thanh thông báo tin nhắn"
              description="Phát âm thanh khi có thông báo tin nhắn mới."
              checked={settings.messageSound}
              onCheckedChange={(value) => toggle("messageSound", value)}
              disabled={isDisabledAll || !settings.messageNotification}
              icon={Volume2}
            />
          </>
        ) : null}

        {category === "calls" ? (
          <>
            <SettingRow
              title="Thông báo cuộc gọi đến"
              description="Hiển thị thông báo khi có cuộc gọi thoại hoặc video đến."
              checked={settings.enableAll}
              onCheckedChange={(value) => toggle("enableAll", value)}
            />
            <SettingRow
              title="Nhạc chuông cuộc gọi"
              description="Sử dụng cài đặt âm thanh chung cho nhạc chuông cuộc gọi."
              checked={settings.soundEnabled}
              onCheckedChange={(value) => toggle("soundEnabled", value)}
              disabled={isDisabledAll}
              icon={Volume2}
            />
          </>
        ) : null}

        {category === "friends" ? (
          <SettingRow
            title="Lời mời kết bạn"
            description="Thông báo khi có lời mời kết bạn mới."
            checked={settings.friendRequestNotification}
            onCheckedChange={(value) => toggle("friendRequestNotification", value)}
            disabled={isDisabledAll}
          />
        ) : null}

        {category === "support" ? (
          <SettingRow
            title="Báo cáo / Hỗ trợ"
            description="Dùng kênh thông báo hệ thống cho phản hồi hỗ trợ và trạng thái báo cáo."
            checked={settings.systemNotification}
            onCheckedChange={(value) => toggle("systemNotification", value)}
            disabled={isDisabledAll}
          />
        ) : null}

        {category === "system" ? (
          <SettingRow
            title="Thông báo hệ thống"
            description="Bảo trì, cập nhật, cảnh báo bảo mật và thay đổi quan trọng."
            checked={settings.systemNotification}
            onCheckedChange={(value) => toggle("systemNotification", value)}
            disabled={isDisabledAll}
          />
        ) : null}

        <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-2 border-t border-white/45 bg-white/75 px-1 py-3 shadow-[0_-18px_42px_-32px_rgba(15,23,42,0.75)] backdrop-blur-xl dark:border-white/10 dark:bg-[#181b2b]/88 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            className="border-white/45 bg-white/45 shadow-sm hover:bg-white/70 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
            onClick={handleReset}
          >
            <RotateCcw className="size-4" />
            Đặt lại
          </Button>
          <Button
            className="app-primary-gradient border-0 text-slate-950 shadow-[0_14px_34px_-18px_rgba(167,139,250,0.95)] hover:opacity-95 dark:text-slate-950"
            onClick={handleSave}
          >
            Lưu cài đặt
          </Button>
        </div>
      </div>
    </div>
  );
};

type SettingRowProps = {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
  icon?: typeof Bell;
};

export const SettingRow = ({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  icon: Icon = Bell,
}: SettingRowProps) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-white/45 bg-white/45 p-3 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
    <div className="flex min-w-0 items-start gap-3">
      <div className="mt-0.5 rounded-lg border border-primary/20 bg-background/60 p-2 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
    <Switch
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="shrink-0 data-[state=checked]:bg-primary-glow"
    />
  </div>
);

const NotificationSettingsDialog = ({ open, setOpen }: Props) => (
  <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="glass-strong max-h-[85vh] overflow-hidden border-border/30 sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" />
          Cài đặt thông báo
        </DialogTitle>
        <DialogDescription>
          Bật hoặc tắt thông báo và âm thanh theo nhu cầu của bạn.
        </DialogDescription>
      </DialogHeader>

      <div className="app-scrollbar-thin overflow-y-auto pr-1">
        <NotificationSettingsPanel compact />
      </div>
    </DialogContent>
  </Dialog>
);

export default NotificationSettingsDialog;
