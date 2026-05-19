import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  Bell,
  KeyRound,
  Monitor,
  Shield,
  ShieldBan,
  Sun,
  Trash2,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";
import UserAvatar from "@/features/chat/components/UserAvatar";
import AvatarUploader from "@/features/settings/components/profile/AvatarUploader";
import PersonalInForm from "@/features/settings/components/profile/PersonalInForm";
import DeleteAccountDialog from "@/features/settings/components/profile/DeleteAccountDialog";
import { ChangePasswordForm } from "@/features/settings/components/profile/ChangePasswordDialog";
import { BlockReportPanel } from "@/features/settings/components/profile/BlockReportDialog";
import {
  NotificationSettingsPanel,
  SettingRow,
} from "@/features/notification/components/NotificationSettingsDialog";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useProfileSettingsStore } from "@/features/settings/stores/useProfileSettingsStore";
import { useSoundSettings } from "@/features/settings/hooks/useSoundSettings";
import { useThemeStore } from "@/features/settings/stores/useThemeStore";
import { getErrorMeta, logger } from "@/shared/lib/logger";
import { useSocketStore } from "@/shared/realtime/useSocketStore";

interface ProfileDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

type SettingsSection =
  | "account"
  | "appearance"
  | "notifications"
  | "sounds"
  | "privacy"
  | "security"
  | "danger";

const menuItems: Array<{
  id: SettingsSection;
  label: string;
  description: string;
  icon: typeof UserRound;
}> = [
  {
    id: "account",
    label: "Tài khoản",
    description: "Thông tin cá nhân",
    icon: UserRound,
  },
  {
    id: "appearance",
    label: "Giao diện",
    description: "Theme và trạng thái",
    icon: Monitor,
  },
  {
    id: "notifications",
    label: "Thông báo",
    description: "Kênh nhận thông báo",
    icon: Bell,
  },
  {
    id: "sounds",
    label: "Âm thanh",
    description: "Hiệu ứng và chuông",
    icon: Volume2,
  },
  {
    id: "privacy",
    label: "Quyền riêng tư",
    description: "Hiển thị hoạt động",
    icon: Shield,
  },
  {
    id: "security",
    label: "Bảo mật",
    description: "Mật khẩu, chặn, báo cáo",
    icon: KeyRound,
  },
  {
    id: "danger",
    label: "Khu vực nguy hiểm",
    description: "Xóa tài khoản",
    icon: Trash2,
  },
];

const ProfileDialog = ({ open, setOpen }: ProfileDialogProps) => {
  const { user } = useAuthStore();
  const { mode, cancelPendingVerification, reset } = useProfileSettingsStore();
  const { isDark, toggleTheme } = useThemeStore();
  const { soundEnabled, setSoundEnabled } = useSoundSettings();
  const {
    onlineUsers,
    showOnlineStatus,
    loadShowOnlineStatus,
    updateShowOnlineStatus,
  } = useSocketStore();
  const [activeSection, setActiveSection] = useState<SettingsSection>("account");
  const [securityView, setSecurityView] = useState<"overview" | "password" | "blocks">("overview");
  const [openDelete, setOpenDelete] = useState(false);
  const isOnline = Boolean(user?._id && onlineUsers.includes(user._id));
  const activeItem = useMemo(
    () => menuItems.find((item) => item.id === activeSection) ?? menuItems[0],
    [activeSection],
  );

  useEffect(() => {
    if (open) {
      loadShowOnlineStatus();
    }
  }, [loadShowOnlineStatus, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (mode === "verify_email_change") {
        void cancelPendingVerification().then((result) => {
          if (!result.ok) {
            toast.error(result.message);
          }
        });
      }

      reset();
      setActiveSection("account");
      setSecurityView("overview");
    }

    setOpen(nextOpen);
  };

  const handleToggleOnline = async (checked: boolean) => {
    try {
      await updateShowOnlineStatus(checked);
    } catch (error) {
      logger.error("Không thể cập nhật trạng thái online", getErrorMeta(error));
      toast.error("Không thể cập nhật trạng thái hoạt động.");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="app-shell-bg flex max-h-[90dvh] w-[min(1120px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-[var(--app-surface-border)] p-0 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.55)] backdrop-blur-2xl sm:max-w-none md:w-[min(1120px,calc(100vw-48px))] lg:max-h-[88dvh]"
        >
          <div className="shrink-0 border-b border-white/45 px-5 py-4 backdrop-blur-xl dark:border-white/10 sm:px-6">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Hồ sơ và cài đặt
            </DialogTitle>
            <DialogDescription className="mt-1 max-w-2xl">
              Quản lý tài khoản, giao diện, thông báo và bảo mật của bạn.
            </DialogDescription>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden lg:grid lg:grid-cols-[292px_minmax(0,1fr)]">
            <aside className="app-scrollbar-thin app-surface max-h-[34dvh] shrink-0 overflow-y-auto overflow-x-hidden border-b p-3 lg:max-h-none lg:min-h-0 lg:border-b-0 lg:border-r lg:p-4">
              <MiniProfileCard
                user={user}
                isOnline={isOnline}
              />

              <nav className="app-scrollbar-thin mt-3 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveSection(item.id);
                        setSecurityView("overview");
                      }}
                      className={cn(
                        "group flex min-w-42 shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left shadow-sm transition-all duration-200 lg:min-w-0",
                        active
                          ? "border-primary/35 bg-white/70 text-foreground shadow-[0_10px_30px_-18px_hsl(var(--primary)/0.65)] ring-1 ring-primary/10 dark:bg-white/[0.08]"
                          : "border-transparent bg-transparent text-muted-foreground hover:border-white/45 hover:bg-white/45 hover:text-foreground dark:hover:border-white/10 dark:hover:bg-white/[0.055]",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg border transition-colors",
                          active
                            ? "border-primary/25 bg-primary/15 text-primary"
                            : "border-border/35 bg-background/45 text-muted-foreground group-hover:text-primary",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{item.label}</span>
                        <span className="hidden truncate text-xs text-muted-foreground lg:block">
                          {item.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <main className="app-scrollbar-thin min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-8 sm:px-6 lg:px-7 lg:pb-10">
              <div className="mx-auto max-w-3xl space-y-4">
                <div className="app-surface rounded-2xl border px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    {activeItem.label}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                    {getSectionTitle(activeSection, securityView)}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {activeItem.description}
                  </p>
                </div>

                {activeSection === "account" ? <PersonalInForm userInfo={user} /> : null}

                {activeSection === "appearance" ? (
                  <SettingsCard
                    title="Giao diện"
                    description="Tùy chỉnh cách ứng dụng hiển thị với bạn."
                    icon={Monitor}
                  >
                    <SettingRow
                      title="Chế độ tối"
                      description="Chuyển đổi giữa giao diện sáng và tối."
                      checked={isDark}
                      onCheckedChange={toggleTheme}
                      icon={Sun}
                    />
                    <SettingRow
                      title="Hiển thị trạng thái hoạt động"
                      description="Cho phép người khác thấy khi bạn đang trực tuyến."
                      checked={showOnlineStatus}
                      onCheckedChange={handleToggleOnline}
                      icon={Shield}
                    />
                  </SettingsCard>
                ) : null}

                {activeSection === "notifications" ? (
                  <SettingsCard
                    title="Thông báo"
                    description="Quản lý từng nhóm thông báo bằng danh mục bên trong."
                    icon={Bell}
                  >
                    <NotificationSettingsPanel compact />
                  </SettingsCard>
                ) : null}

                {activeSection === "sounds" ? (
                  <SettingsCard
                    title="Âm thanh"
                    description="Điều chỉnh âm thanh chung và các hiệu ứng trong ứng dụng."
                    icon={soundEnabled ? Volume2 : VolumeX}
                  >
                    <SettingRow
                      title="Bật tất cả âm thanh"
                      description="Khi tắt, toàn bộ âm thanh trong hệ thống sẽ bị tắt."
                      checked={soundEnabled}
                      onCheckedChange={setSoundEnabled}
                      icon={soundEnabled ? Volume2 : VolumeX}
                    />
                    <SoundHintRows />
                  </SettingsCard>
                ) : null}

                {activeSection === "privacy" ? (
                  <SettingsCard
                    title="Quyền riêng tư"
                    description="Kiểm soát thông tin hoạt động được hiển thị với người khác."
                    icon={Shield}
                  >
                    <SettingRow
                      title="Hiển thị trạng thái hoạt động"
                      description="Cho phép bạn bè nhìn thấy khi bạn đang online."
                      checked={showOnlineStatus}
                      onCheckedChange={handleToggleOnline}
                      icon={Shield}
                    />
                  </SettingsCard>
                ) : null}

                {activeSection === "security" ? (
                  <SecuritySection
                    view={securityView}
                    setView={setSecurityView}
                  />
                ) : null}

                {activeSection === "danger" ? (
                  <SettingsCard
                    title="Khu vực nguy hiểm"
                    description="Các hành động có ảnh hưởng lớn tới tài khoản."
                    icon={Trash2}
                    danger
                  >
                    <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-destructive">Xóa tài khoản</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Xóa vĩnh viễn tài khoản, dữ liệu đăng nhập và phiên hiện tại sau khi xác minh.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        className="shrink-0"
                        onClick={() => setOpenDelete(true)}
                      >
                        <Trash2 className="size-4" />
                        Xóa tài khoản
                      </Button>
                    </div>
                  </SettingsCard>
                ) : null}
              </div>
            </main>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteAccountDialog open={openDelete} setOpen={setOpenDelete} />
    </>
  );
};

type MiniProfileCardProps = {
  user: ReturnType<typeof useAuthStore.getState>["user"];
  isOnline: boolean;
};

const MiniProfileCard = ({ user, isOnline }: MiniProfileCardProps) => {
  if (!user) return null;

  return (
    <div className="app-hero-gradient relative overflow-hidden rounded-2xl border border-white/35 p-4 text-white shadow-[0_18px_44px_-26px_hsl(var(--primary)/0.9)]">
      <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-white/18 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-14 left-8 size-32 rounded-full bg-fuchsia-300/20 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <div className="relative shrink-0">
          <UserAvatar
            type="profile"
            name={user.displayName}
            avatarUrl={user.avatarUrl ?? undefined}
            className="size-14 shadow-lg ring-2 ring-white/70"
          />
          <AvatarUploader />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-6 text-white">{user.displayName}</p>
          <p className="truncate text-sm text-white/82">
            @{user.userName}
          </p>
          <p className="truncate text-xs text-white/70">{user.email}</p>
        </div>
      </div>

      <Badge
        variant="secondary"
        className="relative mt-4 gap-1.5 border border-white/25 bg-white/18 text-white shadow-sm backdrop-blur-md hover:bg-white/22"
      >
        <span
          className={cn(
            "size-2 rounded-full ring-2 ring-white/25",
            isOnline ? "bg-emerald-300" : "bg-slate-300",
          )}
        />
        {isOnline ? "Đang hoạt động" : "Ngoại tuyến"}
      </Badge>
    </div>
  );
};

type SettingsCardProps = {
  title: string;
  description: string;
  icon: typeof UserRound;
  children: React.ReactNode;
  danger?: boolean;
};

const SettingsCard = ({
  title,
  description,
  icon: Icon,
  children,
  danger,
}: SettingsCardProps) => (
  <Card className="app-surface border">
    <CardHeader className="pb-3">
      <CardTitle className={cn("flex items-center gap-2 text-lg", danger && "text-destructive")}>
        <span className={cn("grid size-9 place-items-center rounded-xl border bg-background/50", danger ? "border-destructive/25 text-destructive" : "border-primary/20 text-primary")}>
          <Icon className="size-5" />
        </span>
        {title}
      </CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">{children}</CardContent>
  </Card>
);

type SecuritySectionProps = {
  view: "overview" | "password" | "blocks";
  setView: (view: "overview" | "password" | "blocks") => void;
};

const SecuritySection = ({ view, setView }: SecuritySectionProps) => {
  if (view === "password") {
    return (
      <SettingsCard
        title="Đổi mật khẩu"
        description="Sau khi cập nhật mật khẩu, bạn sẽ cần đăng nhập lại."
        icon={KeyRound}
      >
        <ChangePasswordForm onCancel={() => setView("overview")} />
      </SettingsCard>
    );
  }

  if (view === "blocks") {
    return (
      <SettingsCard
        title="Chặn và báo cáo"
        description="Quản lý danh sách chặn hoặc gửi báo cáo người dùng."
        icon={ShieldBan}
      >
        <BlockReportPanel active />
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      title="Bảo mật"
      description="Các hành động bảo vệ tài khoản và kiểm soát tương tác."
      icon={KeyRound}
    >
      <ActionRow
        icon={KeyRound}
        title="Đổi mật khẩu"
        description="Cập nhật mật khẩu đăng nhập hiện tại."
        actionLabel="Mở"
        onClick={() => setView("password")}
      />
      <ActionRow
        icon={ShieldBan}
        title="Chặn và báo cáo"
        description="Chặn người dùng hoặc gửi báo cáo hành vi xấu."
        actionLabel="Quản lý"
        onClick={() => setView("blocks")}
      />
    </SettingsCard>
  );
};

type ActionRowProps = {
  icon: typeof UserRound;
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
};

const ActionRow = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onClick,
}: ActionRowProps) => (
  <div className="flex flex-col gap-3 rounded-xl border border-white/45 bg-white/45 p-3 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-start gap-3">
      <div className="rounded-lg border border-primary/20 bg-background/60 p-2 text-primary">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
    <Button type="button" variant="outline" className="border-white/45 bg-white/45 shadow-sm hover:bg-white/70 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]" onClick={onClick}>
      {actionLabel}
    </Button>
  </div>
);

const SoundHintRows = () => {
  const rows = [
    "Âm thanh khi gõ",
    "Âm thanh click",
    "Âm thanh thông báo",
    "Nhạc chuông cuộc gọi",
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {rows.map((row) => (
        <div
          key={row}
          className="rounded-xl border border-white/40 bg-white/35 px-3 py-2 text-sm text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/[0.035]"
        >
          {row} dùng theo cài đặt âm thanh chung.
        </div>
      ))}
    </div>
  );
};

const getSectionTitle = (
  section: SettingsSection,
  securityView: "overview" | "password" | "blocks",
) => {
  if (section === "security" && securityView === "password") return "Đổi mật khẩu";
  if (section === "security" && securityView === "blocks") return "Chặn và báo cáo";

  return menuItems.find((item) => item.id === section)?.label ?? "Tài khoản";
};

export default ProfileDialog;
