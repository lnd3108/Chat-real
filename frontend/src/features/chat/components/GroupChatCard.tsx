import { useState } from "react";
import { Bell, BellOff, Info, LogOut, MoreHorizontal, Trash2 } from "lucide-react";

import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import {
  DELETED_USER_LABEL,
  getLastMessageSenderId,
  getParticipantId,
  getParticipantProfile,
} from "@/features/chat/lib/chatParticipants";
import { playClickSound } from "@/features/settings/lib/sound";
import { isGroupNotificationEnabled } from "@/features/chat/lib/groupNotificationSettings";
import type { Conversation } from "@/shared/types/chat";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import ChatCard from "@/features/chat/components/ChatCard";
import UnreadCountBadge from "@/features/chat/components/UnreadCountBadge";
import GroupChatAvatar from "@/features/chat/components/GroupChatAvatar";
import GroupInfoDialog from "@/features/chat/components/GroupInfoDialog";
import GroupNotificationSettingsDialog from "@/features/chat/components/GroupNotificationSettingsDialog";
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
} from "@/shared/ui/alert-dialog";

const GroupChatCard = ({ convo }: { convo: Conversation }) => {
  const { user } = useAuthStore();
  const {
    activeConversationId,
    setActiveConversation,
    messages,
    fetchMessages,
    deleteOrLeaveGroupConversation,
  } = useChatStore();
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  if (!user) return null;

  const unreadCount = convo.unreadCounts[user._id];
  const name = convo.group?.name ?? "";
  const isOwner = convo.group?.createdBy === user._id;
  const notificationsEnabled = isGroupNotificationEnabled(convo._id);
  const lastMessageSenderId = getLastMessageSenderId(convo.lastMessage);
  const senderParticipant = convo.participants.find(
    (participant) => getParticipantId(participant) === lastMessageSenderId,
  );
  const senderName =
    lastMessageSenderId === user._id
      ? "Bạn"
      : convo.lastMessage?.senderDeleted || !lastMessageSenderId
        ? convo.lastMessage?.senderDisplayName ?? DELETED_USER_LABEL
        : getParticipantProfile(senderParticipant)?.displayName ?? "Thành viên";
  const lastMessagePreview = convo.lastMessage?.isDeletedForEveryone
    ? `${senderName} đã xóa một tin nhắn`
    : convo.lastMessage?.content?.trim() ||
      (convo.lastMessage?.imgUrl ? "Đã gửi một hình ảnh" : `${convo.participants.length} members`);

  const handleSelectConversation = async (id: string) => {
    setActiveConversation(id);
    if (!messages[id]) {
      await fetchMessages(id);
    }
  };

  return (
    <>
      <ChatCard
        convoId={convo._id}
        name={name}
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
            {unreadCount > 0 && <UnreadCountBadge unreadCount={unreadCount} />}

            <GroupInfoDialog
              chat={convo}
              open={groupInfoOpen}
              onOpenChange={setGroupInfoOpen}
              trigger={
                <button
                  type="button"
                  className="rounded-full transition-opacity hover:opacity-85"
                  onClick={(event) => {
                    event.stopPropagation();
                    playClickSound();
                    setGroupInfoOpen(true);
                  }}
                  aria-label={`Xem thông tin nhóm ${name}`}
                >
                  <GroupChatAvatar
                    participants={convo.participants}
                    type="chat"
                    avatarUrl={convo.group?.avatarUrl}
                    groupName={name}
                  />
                </button>
              }
            />
          </>
        }
        subtitle={
          <p
            className={`truncate text-sm ${unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}
          >
            {convo.lastMessage ? `${senderName}: ${lastMessagePreview}` : lastMessagePreview}
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

            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => {
                  playClickSound();
                  setGroupInfoOpen(true);
                }}
              >
                <Info className="mr-2 size-4" />
                Thông tin nhóm
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  playClickSound();
                  setNotificationOpen(true);
                }}
              >
                {notificationsEnabled ? (
                  <Bell className="mr-2 size-4" />
                ) : (
                  <BellOff className="mr-2 size-4" />
                )}
                Cài đặt thông báo
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {isOwner ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={(event) => event.preventDefault()}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Xóa nhóm
                    </DropdownMenuItem>
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Xác nhận xóa nhóm?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Bạn là người tạo nhóm. Nếu xác nhận, toàn bộ nhóm và tin nhắn
                        sẽ bị xóa cho tất cả thành viên. Hành động này không thể hoàn tác.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => {
                          playClickSound();
                          deleteOrLeaveGroupConversation(convo._id);
                        }}
                      >
                        Xác nhận xóa
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                      <LogOut className="mr-2 size-4" />
                      Rời nhóm
                    </DropdownMenuItem>
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Xác nhận rời nhóm?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Sau khi rời nhóm, cuộc trò chuyện này sẽ bị xóa khỏi danh sách
                        chat của bạn. Bạn sẽ cần được thêm lại nếu muốn quay lại nhóm.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => {
                          playClickSound();
                          deleteOrLeaveGroupConversation(convo._id);
                        }}
                      >
                        Xác nhận rời nhóm
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <GroupNotificationSettingsDialog
        chat={convo}
        open={notificationOpen}
        onOpenChange={setNotificationOpen}
      />
    </>
  );
};

export default GroupChatCard;
