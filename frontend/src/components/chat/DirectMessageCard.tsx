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
  DropdownMenuSeparator,
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
import { Bell, BellOff, Flag, Info, MoreHorizontal, ShieldBan, Trash2 } from "lucide-react";
import {
  getLastMessageSenderId,
  getParticipantId,
  getParticipantProfile,
} from "@/lib/chatParticipants";
import { playClickSound } from "@/lib/sound";
import { useState } from "react";
import DirectNotificationSettingsDialog from "./DirectNotificationSettingsDialog";
import DirectProfileDialog from "./DirectProfileDialog";
import { isDirectNotificationEnabled, isUserBlocked, toggleBlockedUser } from "@/lib/directChatPreferences";
import { toast } from "sonner";
import DirectInfoDialog from "./DirectInfoDialog";

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
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

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
  const notificationsEnabled = isDirectNotificationEnabled(convo._id);
  const blocked = isUserBlocked(otherUser.userName);

  const handleSelectConversation = async (id: string) => {
    setActiveConversation(id);
    if (!messages[id]) {
      await fetchMessages(id);
    }
  };

  const handleToggleBlock = () => {
    if (!otherUser.userName) {
      toast.error("Không tìm thấy username để chặn.");
      return;
    }

    const result = toggleBlockedUser(otherUser.userName);
    toast.success(
      result.blocked ? `Đã chặn @${otherUser.userName}` : `Đã bỏ chặn @${otherUser.userName}`,
    );
  };

  return (
    <>
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
            <DirectProfileDialog
              open={profileOpen}
              onOpenChange={setProfileOpen}
              displayName={otherUser.displayName ?? "ChatRealTime"}
              userName={otherUser.userName}
              avatarUrl={otherUser.avatarUrl ?? undefined}
              bio={otherUser.bio}
              statusLabel={onlineUsers.includes(otherId) ? "Đang hoạt động" : "Ngoại tuyến"}
              trigger={
                <button
                  type="button"
                  className="relative block rounded-full transition-opacity hover:opacity-85"
                  onClick={(event) => {
                    event.stopPropagation();
                    playClickSound();
                    setProfileOpen(true);
                  }}
                  aria-label={`Xem hồ sơ ${otherUser.displayName}`}
                >
                  <UserAvatar
                    type="sidebar"
                    name={otherUser.displayName ?? ""}
                    avatarUrl={otherUser.avatarUrl ?? undefined}
                  />
                  <StatusBadge
                    status={onlineUsers.includes(otherId) ? "online" : "offline"}
                  />
                </button>
              }
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
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={playClickSound}
              >
                <MoreHorizontal className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => {
                playClickSound();
                setProfileOpen(true);
              }}>
                <Info className="mr-2 size-4" />
                Xem hồ sơ
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => {
                playClickSound();
                setInfoOpen(true);
              }}>
                <Flag className="mr-2 size-4" />
                Thiết lập đoạn chat
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => {
                playClickSound();
                setNotificationOpen(true);
              }}>
                {notificationsEnabled ? (
                  <Bell className="mr-2 size-4" />
                ) : (
                  <BellOff className="mr-2 size-4" />
                )}
                Cài đặt thông báo
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => {
                playClickSound();
                handleToggleBlock();
              }}>
                <ShieldBan className="mr-2 size-4" />
                {blocked ? "Bỏ chặn" : "Chặn"}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

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
                      onClick={() => {
                        playClickSound();
                        deleteOrLeaveGroupConversation(convo._id);
                      }}
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

      <DirectNotificationSettingsDialog
        chat={convo}
        displayName={otherUser.displayName ?? "người dùng này"}
        open={notificationOpen}
        onOpenChange={setNotificationOpen}
      />

      <DirectInfoDialog
        chat={convo}
        displayName={otherUser.displayName ?? "ChatRealTime"}
        userName={otherUser.userName}
        avatarUrl={otherUser.avatarUrl ?? undefined}
        bio={otherUser.bio}
        open={infoOpen}
        onOpenChange={setInfoOpen}
      />
    </>
  );
};

export default DirectMessageCard;
