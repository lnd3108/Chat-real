import { useRef, useState, type ChangeEvent } from "react";
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
import { getParticipantId, getParticipantProfile } from "@/lib/chatParticipants";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { chatServices } from "@/services/chatServices";

const ChatWindowHeader = ({ chat }: { chat?: Conversation }) => {
  const { conversations, activeConversationId } = useChatStore();
  const { user } = useAuthStore();
  const { onlineUsers } = useSocketStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

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

  const handleOpenFilePicker = () => {
    if (activeChat.type !== "group" || avatarUploading) return;
    fileInputRef.current?.click();
  };

  const handleGroupAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || activeChat.type !== "group") return;

    try {
      setAvatarUploading(true);
      const updatedConversation = await chatServices.uploadGroupAvatar(
        activeChat._id,
        file,
      );

      useChatStore.getState().updateConversation({
        _id: updatedConversation._id,
        group: updatedConversation.group,
        participants: updatedConversation.participants,
        moveToTop: false,
      });

      toast.success("Da cap nhat anh dai dien nhom");
    } catch (error) {
      console.error("uploadGroupAvatar failed", error);
      toast.error("Khong the cap nhat anh dai dien nhom");
    } finally {
      setAvatarUploading(false);
    }
  };

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
              <>
                <button
                  type="button"
                  onClick={handleOpenFilePicker}
                  disabled={avatarUploading}
                  className="relative block rounded-full transition-opacity hover:opacity-90 disabled:cursor-not-allowed"
                  aria-label="Doi anh dai dien nhom"
                >
                  <GroupChatAvatar
                    participants={activeChat.participants}
                    type="sidebar"
                    avatarUrl={activeChat.group?.avatarUrl}
                    groupName={activeChat.group?.name}
                    isUploading={avatarUploading}
                  />
                  <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm">
                    <Camera className="size-3" />
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleGroupAvatarChange}
                />
              </>
            )}
          </div>

          <h2 className="font-semibold text-foreground">
            {activeChat.type === "direct"
              ? otherUser?.displayName
              : activeChat.group?.name}
          </h2>
        </div>

        {activeChat.type === "group" && activeChat.group?.createdBy === user?._id && (
          <GroupMemberManagerDialog chat={activeChat} />
        )}
      </div>
    </header>
  );
};

export default ChatWindowHeader;
