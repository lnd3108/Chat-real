import { ChevronsUpDown, LogOut, UserIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/shared/ui/sidebar";

import type { User } from "@/shared/types/user";
import ProfileDialog from "@/features/settings/components/profile/ProfileDialog";

import { useFriendStore } from "@/features/friend/stores/useFriendStore";
import NotificationMenuItem from "@/features/notification/components/NotificationMenuItem";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { getErrorMeta, logger } from "@/shared/lib/logger";
import { useNavigate } from "react-router";
import { useNotificationStore } from "@/features/notification/stores/useNotificationStore";
import NotificationCenterDialog from "@/features/notification/components/NotificationCenterDialog";


export function NavUser({ user }: { user: User }) {
  const { isMobile } = useSidebar();
  const { signOut } = useAuthStore();
  const navigate = useNavigate();

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const { getAllFriendRequests } = useFriendStore();
  const notiCount = useNotificationStore((state) => state.unreadCount());

  useEffect(() => {
    getAllFriendRequests();
  }, [getAllFriendRequests]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/signin");
    } catch (error) {
      logger.error("Khong the dang xuat", getErrorMeta(error));
    }
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="relative data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                {notiCount > 0 && (
                  <span className="absolute top-1.5 right-8 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white shadow-sm">
                    {notiCount > 99 ? "99+" : notiCount}
                  </span>
                )}
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatarUrl ?? undefined} alt={user.displayName} />
                  <AvatarFallback className="rounded-lg">
                    {user.displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.displayName}</span>
                  <span className="truncate text-xs">{user.userName}</span>
                </div>

                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.avatarUrl ?? undefined} alt={user.userName} />
                    <AvatarFallback className="rounded-lg">
                      {user.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.displayName}</span>
                    <span className="truncate text-xs">{user.userName}</span>
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                  <UserIcon className="text-muted-foreground dark:group-focus:!text-accent-foreground" />
                  Tài Khoản
                </DropdownMenuItem>

                <NotificationMenuItem
                  count={notiCount}
                  onClick={() => setNotificationOpen(true)}
                />
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="cursor-pointer"
                variant="destructive"
                onSelect={() => void handleLogout()}
              >
                <LogOut className="text-destructive" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <NotificationCenterDialog
        open={notificationOpen}
        setOpen={setNotificationOpen}
      />

      <ProfileDialog open={profileOpen} setOpen={setProfileOpen} />
    </>
  );
}
