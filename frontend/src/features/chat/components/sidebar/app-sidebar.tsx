"use client";

import * as React from "react";
import { Moon, Sun, Volume2, VolumeX } from "lucide-react";

import { NavUser } from "@/features/chat/components/sidebar/nav-user";
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
} from "@/shared/ui/sidebar";
import { useSoundSettings } from "@/features/settings/hooks/useSoundSettings";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import { useThemeStore } from "@/features/settings/stores/useThemeStore";

import AddFriendModal from "@/features/chat/components/AddFriendModal";
import CreateNewChat from "@/features/chat/components/CreateNewChat";
import DirrectMessageList from "@/features/chat/components/DirrectMessageList";
import FriendManagementDialog from "@/features/chat/components/FriendManagementDialog";
import GroupChatList from "@/features/chat/components/GroupChatList";
import NewGroupChatModal from "@/features/chat/components/NewGroupChatModal";
import SupportConversationList from "@/features/chat/components/SupportConversationList";
import ConversationSkeleton from "@/shared/ui/skeleton/ConversationSkeleton";
import { Switch } from "@/shared/ui/switch";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isDark, toggleTheme } = useThemeStore();
  const { soundEnabled, setSoundEnabled } = useSoundSettings();
  const { user } = useAuthStore();
  const { convoLoading } = useChatStore();

  return (
    <Sidebar variant="inset" className="md:flex-shrink-0" {...props}>
      <SidebarHeader className="border-b border-sidebar-border/70">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="h-auto min-h-16 cursor-default bg-gradient-primary p-3 hover:bg-gradient-primary hover:text-white"
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-white sm:text-xl">
                  ChatRealTime
                </h1>

                <div className="flex flex-shrink-0 items-center gap-3 rounded-full bg-white/10 px-2.5 py-1.5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5">
                    <Sun className="size-4 flex-shrink-0 text-white/80" />
                    <Switch
                      checked={isDark}
                      onCheckedChange={toggleTheme}
                      className="flex-shrink-0 data-[state=checked]:bg-background/80"
                      aria-label="Đổi theme"
                    />
                    <Moon className="size-4 flex-shrink-0 text-white/80" />
                  </div>

                  <div className="h-5 w-px bg-white/25" />

                  <div className="flex items-center gap-1.5">
                    {soundEnabled ? (
                      <Volume2 className="size-4 flex-shrink-0 text-white/80" />
                    ) : (
                      <VolumeX className="size-4 flex-shrink-0 text-white/80" />
                    )}
                    <Switch
                      checked={soundEnabled}
                      onCheckedChange={setSoundEnabled}
                      className="flex-shrink-0 data-[state=checked]:bg-background/80"
                      aria-label="Bật hoặc tắt âm thanh"
                    />
                  </div>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="app-scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupContent>
            <CreateNewChat />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="uppercase">
            Cuộc trò chuyện nhóm
          </SidebarGroupLabel>
          <SidebarGroupAction
            asChild
            title="Tạo nhóm"
            className="h-5 w-auto cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <NewGroupChatModal />
            </div>
          </SidebarGroupAction>
          <SidebarGroupContent>
            {convoLoading ? <ConversationSkeleton /> : <GroupChatList />}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="uppercase">Bạn bè</SidebarGroupLabel>
          <SidebarGroupAction
            asChild
            title="Kết bạn"
            className="cursor-pointer"
          >
            <div className="inline-flex items-center justify-end gap-3">
              <FriendManagementDialog />
              <AddFriendModal />
            </div>
          </SidebarGroupAction>
          <SidebarGroupContent>
            {convoLoading ? <ConversationSkeleton /> : <DirrectMessageList />}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="uppercase">Hỗ trợ</SidebarGroupLabel>
          <SidebarGroupContent>
            {convoLoading ? <ConversationSkeleton /> : <SupportConversationList />}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>{user && <NavUser user={user} />}</SidebarFooter>
    </Sidebar>
  );
}
