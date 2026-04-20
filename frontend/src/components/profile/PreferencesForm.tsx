import { useEffect } from "react";
import { Moon, Sun, Volume2, VolumeX } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSoundSettings } from "@/hooks/useSoundSettings";
import { useSocketStore } from "@/stores/useSocketStore";
import { useThemeStore } from "@/stores/useThemeStore";

const PreferencesForm = () => {
  const { isDark, toggleTheme } = useThemeStore();
  const { soundEnabled, setSoundEnabled } = useSoundSettings();
  const {
    showOnlineStatus,
    loadShowOnlineStatus,
    updateShowOnlineStatus,
  } = useSocketStore();

  useEffect(() => {
    loadShowOnlineStatus();
  }, [loadShowOnlineStatus]);

  const handleToggleOnline = async (checked: boolean) => {
    try {
      await updateShowOnlineStatus(checked);
    } catch (error) {
      console.error("Failed to update showOnlineStatus:", error);
    }
  };

  return (
    <Card className="glass-strong border-border/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-primary" />
          Tùy chỉnh ứng dụng
        </CardTitle>
        <CardDescription>
          Cá nhân hóa trải nghiệm trò chuyện của bạn
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="theme-toggle" className="text-base font-medium">
              Chế độ tối
            </Label>
            <p className="text-sm text-muted-foreground">
              Chuyển đổi giữa giao diện sáng và tối
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <Switch
              id="theme-toggle"
              checked={isDark}
              onCheckedChange={toggleTheme}
              className="data-[state=checked]:bg-primary-glow"
            />
            <Moon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="online-status" className="text-base font-medium">
              Hiển thị trạng thái hoạt động
            </Label>
            <p className="text-sm text-muted-foreground">
              Cho phép người khác thấy khi bạn đang trực tuyến
            </p>
          </div>

          <Switch
            id="online-status"
            checked={showOnlineStatus}
            onCheckedChange={handleToggleOnline}
            className="data-[state=checked]:bg-primary-glow"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="sound-toggle" className="text-base font-medium">
              Âm thanh ứng dụng
            </Label>
            <p className="text-sm text-muted-foreground">
              Khi tắt, toàn bộ âm thanh trong hệ thống sẽ bị tắt
            </p>
          </div>

          <div className="flex items-center gap-2">
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-muted-foreground" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
            <Switch
              id="sound-toggle"
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
              className="data-[state=checked]:bg-primary-glow"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PreferencesForm;
