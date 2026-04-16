import type { Conversation } from "@/types/chat";
import ChatCard from "./ChatCard";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { cn } from "@/lib/utils";
import UserAvatar from "./UserAvatar";
import StatusBadge from "./StatusBadge";
import UnreadCountBadge from "./UnreadCountBadge";
import { useSocketStore } from "@/stores/useSocketStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  getLastMessageSenderId,
  getParticipantId,
  getParticipantProfile,
} from "@/lib/chatParticipants";

const DirectMessageCard = ({ convo }: { convo: Conversation }) => {
  const { user } = useAuthStore();
  const {
    activeConversationId,
    setActiveConversation,
    messages,
    fetchMessages,
    deleteOrLeaveGroupConversation,
  } = useChatStore();
  const { onlineUsers } = useSocketStore();

  if (!user) return null;

  const otherRaw = convo.participants.find(
    (participant) => getParticipantId(participant) !== user._id,
  );
  const otherUser = getParticipantProfile(otherRaw);
  if (!otherRaw || !otherUser) return null;

  const otherId = String(getParticipantId(otherRaw));
  const unreadCount = convo.unreadCounts?.[user._id] ?? 0;
  const recallPlaceholder = "Bạn đã xóa một tin nhắn";
  const lastMessageSenderId = getLastMessageSenderId(convo.lastMessage);
  const isRecallMessage =
    convo.lastMessage?.isDeletedForEveryone ||
    convo.lastMessage?.content === recallPlaceholder;
  const lastMessage = isRecallMessage
    ? lastMessageSenderId === user._id
      ? recallPlaceholder
      : `${otherUser.displayName ?? "Người dùng"} đã xóa một tin nhắn`
    : (convo.lastMessage?.content ?? "");

  const handleSelectConversation = async (id: string) => {
    setActiveConversation(id);
    if (!messages[id]) {
      await fetchMessages(id);
    }
  };

  return (
    <ChatCard
      convoId={convo._id}
      name={otherUser.displayName ?? ""}
      timestamp={
        convo.lastMessage?.createdAt
          ? new Date(convo.lastMessage.createdAt)
          : undefined
      }
      isActive={activeConversationId === convo._id}
      onSelect={handleSelectConversation}
      unreadCount={unreadCount}
      leftSection={
        <>
          <UserAvatar
            type="sidebar"
            name={otherUser.displayName ?? ""}
            avatarUrl={otherUser.avatarUrl ?? undefined}
          />
          <StatusBadge
            status={onlineUsers.includes(otherId) ? "online" : "offline"}
          />
          {unreadCount > 0 && <UnreadCountBadge unreadCount={unreadCount} />}
        </>
      }
      subtitle={
        <p
          className={cn(
            "truncate text-sm",
            unreadCount > 0
              ? "font-medium text-foreground"
              : "text-muted-foreground",
          )}
        >
          {lastMessage}
        </p>
      }
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-44">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => e.preventDefault()}
                >
                  <Trash2 className="mr-2 size-4" />
                  Xóa đoạn chat
                </DropdownMenuItem>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Xóa lịch sử chat?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Lịch sử chat sẽ chỉ bị xóa ở phía bạn. Người còn lại vẫn giữ
                    nguyên cuộc trò chuyện.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteOrLeaveGroupConversation(convo._id)}
                  >
                    Xóa
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
};

export default DirectMessageCard;
