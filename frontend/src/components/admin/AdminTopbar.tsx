import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Bell,
  ChevronDown,
  LogOut,
  Moon,
  Search,
  Sun,
  UserCircle2,
  Volume2,
  VolumeX,
} from "lucide-react";

import AdminNotificationCenterDialog from "@/components/admin/AdminNotificationCenterDialog";
import ProfileDialog from "@/components/profile/ProfileDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useSoundSettings } from "@/hooks/useSoundSettings";
import { getRoleLabel, hasAdminPanelAccess } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { useAdminNotificationStore } from "@/stores/useAdminNotificationStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { useThemeStore } from "@/stores/useThemeStore";

import UserAvatar from "../chat/UserAvatar";

const AdminTopbar = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const userUnreadCount = useNotificationStore((state) => state.unreadCount());
  const adminUnreadCount = useAdminNotificationStore((state) => state.unreadCount());
  const { isDark, toggleTheme } = useThemeStore();
  const { soundEnabled, setSoundEnabled, toggleSound } = useSoundSettings();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const displayName = user?.displayName || "Admin";
  const unreadCount = hasAdminPanelAccess(user) ? adminUnreadCount : userUnreadCount;
  const roleLabel = user?.role ? getRoleLabel(user.role) : "Người dùng";

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/signin");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      <header className="border-b border-border/50 bg-card/50 px-4 py-4 backdrop-blur-sm md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-md flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Tìm kiếm nhanh trong admin..."
                className="border-border/50 bg-muted/50 pl-10 focus:border-primary/50"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 md:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative rounded-xl"
              aria-label="Mở thông báo"
              onClick={() => setNotificationOpen(true)}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <Badge
                  variant="destructive"
                  className="absolute -right-1 -top-1 h-5 min-w-5 px-1 text-[10px]"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              ) : null}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-xl"
              aria-label={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
              onClick={toggleTheme}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-xl"
              aria-label={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
              onClick={toggleSound}
            >
              {soundEnabled ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <VolumeX className="h-5 w-5" />
              )}
            </Button>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto rounded-2xl border border-border/50 px-2 py-2 hover:bg-muted/60"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      type="chat"
                      name={displayName}
                      avatarUrl={user?.avatarUrl ?? undefined}
                      className="size-9"
                    />
                    <div className="hidden min-w-0 text-left sm:block">
                      <p className="truncate text-sm font-medium text-foreground">
                        {displayName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-64 rounded-2xl">
                <DropdownMenuLabel className="pb-2">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      type="chat"
                      name={displayName}
                      avatarUrl={user?.avatarUrl ?? undefined}
                      className="size-10"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user?.email || roleLabel}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
                  <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                  Hồ sơ admin
                </DropdownMenuItem>

                <DropdownMenuCheckboxItem checked={isDark} onCheckedChange={toggleTheme}>
                  {isDark ? (
                    <Sun className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Moon className="h-4 w-4 text-muted-foreground" />
                  )}
                  Đổi theme
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={soundEnabled}
                  onCheckedChange={setSoundEnabled}
                >
                  {soundEnabled ? (
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  )}
                  Bật/tắt âm thanh
                </DropdownMenuCheckboxItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className={cn("text-destructive focus:text-destructive")}
                  onSelect={() => void handleLogout()}
                >
                  <LogOut className="h-4 w-4 text-destructive" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <AdminNotificationCenterDialog open={notificationOpen} setOpen={setNotificationOpen} />
      <ProfileDialog open={profileOpen} setOpen={setProfileOpen} />
    </>
  );
};

export default AdminTopbar;
