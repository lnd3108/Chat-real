import { useChatStore } from "@/stores/useChatStore";
import type { Conversation } from "@/types/chat";
import { SidebarTrigger } from "../ui/sidebar";
import { useAuthStore } from "@/stores/useAuthStore";
import { Separator } from "@radix-ui/react-separator";
import UserAvatar from "./UserAvatar";
import StatusBadge from "./StatusBadge";
import GroupChatAvatar from "./GroupChatAvatar";
import { useSocketStore } from "@/stores/useSocketStore";
import GroupMemberManagerDialog from "./GroupMemberManagerDialog";
import GroupSettingsDialog from "./GroupSettingsDialog";
import { getParticipantId, getParticipantProfile } from "@/lib/chatParticipants";
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";

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
                <UserAvatar
                  type="sidebar"
                  name={otherUser?.displayName || "ChatRealTime"}
                  avatarUrl={otherUser?.avatarUrl || undefined}
                />
                <StatusBadge
                  status={onlineUsers.includes(otherId) ? "online" : "offline"}
                />
              </>
            ) : (
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    disabled={!activeChat.group?.avatarUrl}
                    className="relative block rounded-full transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-100"
                    aria-label="Xem anh dai dien nhom"
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
                  {activeChat.group?.avatarUrl && (
                    <img
                      src={activeChat.group.avatarUrl}
                      alt={activeChat.group?.name ?? "Group avatar"}
                      className="h-screen w-screen object-contain"
                    />
                  )}
                </DialogContent>
              </Dialog>
            )}
          </div>

          <h2 className="font-semibold text-foreground">
            {activeChat.type === "direct"
              ? otherUser?.displayName
              : activeChat.group?.name}
          </h2>
        </div>

        {activeChat.type === "group" && (
          <div className="flex items-center">
            <GroupSettingsDialog chat={activeChat} />
            {activeChat.group?.createdBy === user?._id && (
              <GroupMemberManagerDialog chat={activeChat} />
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default ChatWindowHeader;
