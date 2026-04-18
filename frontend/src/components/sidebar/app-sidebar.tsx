"use client";

import * as React from "react";

import { NavUser } from "@/components/sidebar/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Moon, Sun, Volume2, VolumeX } from "lucide-react";
import { Switch } from "../ui/switch";
import CreateNewChat from "../chat/CreateNewChat";
import NewGroupChatModal from "../chat/NewGroupChatModal";
import GroupChatList from "../chat/GroupChatList";
import AddFriendModal from "../chat/AddFriendModal";
import DirrectMessageList from "../chat/DirrectMessageList";
import { useThemeStore } from "@/stores/useThemeStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import ConversationSkeleton from "../skeleton/ConversationSkeleton";
import {
  areAllSoundsEnabled,
  getNotificationSettings,
  setAllSoundsEnabled,
  subscribeNotificationSettings,
} from "@/lib/messageNotifications";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isDark, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();
  const { convoLoading } = useChatStore();
  const [soundEnabled, setSoundEnabled] = React.useState(() =>
    areAllSoundsEnabled(getNotificationSettings()),
  );

  React.useEffect(
    () =>
      subscribeNotificationSettings((settings) => {
        setSoundEnabled(areAllSoundsEnabled(settings));
      }),
    [],
  );

  return (
    <Sidebar variant="inset" {...props}>
      {/* Header */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="bg-gradient-primary"
            >
              <a href="#">
                <div className="flex w-full items-center px-2 justify-between">
                  <h1 className="text-xl font-bold text-white">ChatRealTime</h1>
                  <div className="flex items-center gap-2">
                    <Sun className="size-4 text-white/80" />
                    <Switch
                      checked={isDark}
                      onCheckedChange={toggleTheme}
                      className="data-[state=checked]:bg-background/80"
                    />
                    <Moon className="size-4 text-white/80" />
                    {soundEnabled ? (
                      <Volume2 className="size-4 text-white/80" />
                    ) : (
                      <VolumeX className="size-4 text-white/80" />
                    )}
                    <Switch
                      checked={soundEnabled}
                      onCheckedChange={(checked) => {
                        setSoundEnabled(checked);
                        setAllSoundsEnabled(checked);
                      }}
                      className="data-[state=checked]:bg-background/80"
                      aria-label="Bật hoặc tắt âm thanh"
                    />
                  </div>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent className="beautifull-scrollbar">
        {/* New Chat */}
        <SidebarGroup>
          <SidebarGroupContent>
            <CreateNewChat />
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Group Chat */}
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase">
            Cuộc trò chuyện nhóm
          </SidebarGroupLabel>
          <SidebarGroupAction
            asChild
            title="Tạo Nhóm"
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <NewGroupChatModal />
            </div>
          </SidebarGroupAction>
          <SidebarGroupContent>
            {convoLoading ? <ConversationSkeleton /> : <GroupChatList />}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Dirrect Chat */}
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase">Bạn Bè</SidebarGroupLabel>
          <SidebarGroupAction
            asChild
            title="Kết Bạn"
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <AddFriendModal />
            </div>
          </SidebarGroupAction>
          <SidebarGroupContent>
            {convoLoading ? <ConversationSkeleton /> : <DirrectMessageList />}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>{user && <NavUser user={user} />}</SidebarFooter>
    </Sidebar>
  );
}
