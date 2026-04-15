import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSocketStore } from "@/stores/useSocketStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";

const PreferencesForm = () => {
  const { isDark, toggleTheme } = useThemeStore();
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
          Tuy chinh ung dung
        </CardTitle>
        <CardDescription>Ca nhan hoa trai nghiem tro chuyen cua ban</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="theme-toggle" className="text-base font-medium">
              Che do toi
            </Label>
            <p className="text-sm text-muted-foreground">
              Chuyen doi giua giao dien sang va toi
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
              Hien thi trang thai online
            </Label>
            <p className="text-sm text-muted-foreground">
              Cho phep nguoi khac thay khi ban dang online
            </p>
          </div>

          <Switch
            id="online-status"
            checked={showOnlineStatus}
            onCheckedChange={handleToggleOnline}
            className="data-[state=checked]:bg-primary-glow"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default PreferencesForm;
