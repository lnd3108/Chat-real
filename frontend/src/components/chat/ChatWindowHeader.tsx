import { useChatStore } from "@/stores/useChatStore";
import type { Conversation } from "@/types/chat";
import { SidebarTrigger } from "../ui/sidebar";
import { useAuthStore } from "@/stores/useAuthStore";
import { Separator } from "@radix-ui/react-separator";
import { Settings } from "lucide-react";
import UserAvatar from "./UserAvatar";
import StatusBadge from "./StatusBadge";
import GroupChatAvatar from "./GroupChatAvatar";
import { useSocketStore } from "@/stores/useSocketStore";
import GroupInfoDialog from "./GroupInfoDialog";
import { getParticipantId, getParticipantProfile } from "@/lib/chatParticipants";
import DirectProfileDialog from "./DirectProfileDialog";
import DirectInfoDialog from "./DirectInfoDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";

const ChatWindowHeader = ({ chat }: { chat?: Conversation }) => {
  const { conversations, activeConversationId } = useChatStore();
  const { user } = useAuthStore();
  const { onlineUsers } = useSocketStore();

  const activeChat = chat ?? conversations.find((c) => c._id === activeConversationId);

  if (!activeChat) {
    return (
      <header className="sticky top-0 z-10 flex w-full items-center gap-2 px-4 py-2 md:hidden">
        <SidebarTrigger className="-ml-1 text-foreground" />
      </header>
    );
  }

  const otherParticipant =
    activeChat.type === "direct"
      ? activeChat.participants.find(
          (participant) => getParticipantId(participant) !== user?._id,
        )
      : undefined;
  const otherUser = getParticipantProfile(otherParticipant);
  const otherId = getParticipantId(otherParticipant);

  if (activeChat.type === "direct" && (!user || !otherUser)) {
    return null;
  }

  return (
    <header className="sticky top-0 z-10 flex items-center bg-background px-4 py-2">
      <div className="flex w-full items-center gap-2">
        <SidebarTrigger className="-ml-1 text-foreground" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />

        <div className="flex w-full items-center gap-3 p-2">
          <div className="relative">
            {activeChat.type === "direct" ? (
              <>
                <DirectProfileDialog
                  displayName={otherUser?.displayName || "ChatRealTime"}
                  userName={otherUser?.userName}
                  avatarUrl={otherUser?.avatarUrl || undefined}
                  bio={otherUser?.bio}
                  statusLabel={
                    onlineUsers.includes(otherId) ? "Đang hoạt động" : "Ngoại tuyến"
                  }
                  trigger={
                    <button
                      type="button"
                      className="relative block rounded-full transition-opacity hover:opacity-90"
                      aria-label="Xem hồ sơ người dùng"
                    >
                      <UserAvatar
                        type="sidebar"
                        name={otherUser?.displayName || "ChatRealTime"}
                        avatarUrl={otherUser?.avatarUrl || undefined}
                      />
                      <StatusBadge
                        status={onlineUsers.includes(otherId) ? "online" : "offline"}
                      />
                    </button>
                  }
                />
              </>
            ) : (
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    disabled={!activeChat.group?.avatarUrl}
                    className="relative block rounded-full transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-100"
                    aria-label="Xem ảnh đại diện nhóm"
                  >
                    <GroupChatAvatar
                      participants={activeChat.participants}
                      type="sidebar"
                      avatarUrl={activeChat.group?.avatarUrl}
                      groupName={activeChat.group?.name}
                    />
                  </button>
                </DialogTrigger>
                <DialogContent
                  className="max-h-[100vh] w-screen max-w-screen border-0 bg-black/95 p-0 shadow-none"
                  showCloseButton={false}
                >
                  <DialogTitle className="sr-only">Ảnh đại diện nhóm</DialogTitle>
                  <DialogDescription className="sr-only">
                    Xem phóng to ảnh đại diện của nhóm chat hiện tại.
                  </DialogDescription>
                  {activeChat.group?.avatarUrl && (
                    <img
                      src={activeChat.group.avatarUrl}
                      alt={activeChat.group?.name ?? "Ảnh đại diện nhóm"}
                      className="h-screen w-screen object-contain"
                    />
                  )}
                </DialogContent>
              </Dialog>
            )}
          </div>

          {activeChat.type === "direct" ? (
            <h2 className="font-semibold text-foreground">{otherUser?.displayName}</h2>
          ) : (
            <GroupInfoDialog
              chat={activeChat}
              trigger={
                <button
                  type="button"
                  className="min-w-0 text-left transition-opacity hover:opacity-80"
                >
                  <h2 className="truncate font-semibold text-foreground">
                    {activeChat.group?.name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {activeChat.participants.length} thành viên
                  </p>
                </button>
              }
            />
          )}
        </div>

        {activeChat.type === "group" && (
          <GroupInfoDialog
            chat={activeChat}
            trigger={
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                <Settings className="size-4" />
                <span className="sr-only">Cài đặt nhóm</span>
              </Button>
            }
          />
        )}

        {activeChat.type === "direct" && (
          <DirectInfoDialog
            chat={activeChat}
            displayName={otherUser?.displayName || "ChatRealTime"}
            userName={otherUser?.userName}
            avatarUrl={otherUser?.avatarUrl || undefined}
            bio={otherUser?.bio}
            trigger={
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                <Settings className="size-4" />
                <span className="sr-only">Cài đặt đoạn chat</span>
              </Button>
            }
          />
        )}
      </div>
    </header>
  );
};

export default ChatWindowHeader;
