import { cn, formatMessageTime } from "@/lib/utils";
import type { Conversation, Message, Participant } from "@/types/chat";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import UserAvatar from "./UserAvatar";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Heart,
  MessageSquareReply,
  MoreHorizontal,
  Pencil,
  SmilePlus,
  Trash2,
} from "lucide-react";

interface MessageItemProps {
  message: Message;
  index: number;
  messages: Message[];
  selectedConvo: Conversation;
  lastMessageStatus: "delivered" | "seen";
}

const MessageItem = ({
  message,
  index,
  messages,
  selectedConvo,
  lastMessageStatus,
}: MessageItemProps) => {
  const { user } = useAuthStore();
  const {
    deleteMessageForEveryone,
    deleteMessageForMe,
    setEditingMessage,
    setReplyingTo,
    toggleReaction,
  } = useChatStore();
  const prev = index + 1 < messages.length ? messages[index + 1] : undefined;
  const reactionOptions = ["👍", "❤️", "😂", "😮", "😡"];

  const isShowTime =
    index === 0 ||
    new Date(message.createdAt).getTime() -
      new Date(prev?.createdAt || 0).getTime() >
      300000;

  const isGroupBreak = isShowTime || message.senderId !== prev?.senderId;

  const participant = selectedConvo.participants.find(
    (p: Participant) => p._id?.toString() === message.senderId?.toString(),
  );
  const replySender = selectedConvo.participants.find(
    (p: Participant) => p._id?.toString() === message.replyTo?.senderId?.toString(),
  );
  const canEdit = message.isOwn && !message.isDeletedForEveryone && message.type !== "system";
  const canRecallForEveryone =
    message.isOwn && !message.isDeletedForEveryone && message.type !== "system";
  const reactionBadges = (message.reactions ?? []).filter(
    (reaction) => reaction.userIds.length > 0,
  );
  const deletedMessageLabel = message.isOwn
    ? "Bạn đã xóa một tin nhắn"
    : `${participant?.displayName ?? "Người dùng"} đã xóa một tin nhắn`;

  if (message.type === "system") {
    return (
      <>
        {isShowTime && (
          <div className="w-full flex justify-center my-3">
            <span className="text-xs text-muted-foreground px-2 py-1 rounded-full bg-muted/40">
              {formatMessageTime(new Date(message.createdAt))}
            </span>
          </div>
        )}

        <div className="my-3 flex justify-center">
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {message.content}
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      {isShowTime && (
        <div className="w-full flex justify-center my-3">
          <span className="text-xs text-muted-foreground px-2 py-1 rounded-full bg-muted/40">
            {formatMessageTime(new Date(message.createdAt))}
          </span>
        </div>
      )}

      <div
        className={cn(
          "flex gap-2 message-bounce mt-1",
          message.isOwn ? "justify-end" : "justify-start",
        )}
      >
        {!message.isOwn && (
          <div className="w-8">
            {isGroupBreak && (
              <UserAvatar
                type="chat"
                name={participant?.displayName ?? "ChatRealTime"}
                avatarUrl={participant?.avatarUrl ?? undefined}
              />
            )}
          </div>
        )}

        <div
          className={cn(
            "max-w-xs lg:max-w-md space-y-1 flex flex-col",
            message.isOwn ? "items-end" : "items-start",
          )}
        >
          <Card
            className={cn(
              "p-3",
              message.isOwn
                ? "chat-bubble-sent border-0"
                : "chat-bubble-received",
            )}
          >
            <div className="space-y-2">
              {message.replyTo && (
                <div className="rounded-lg border border-border/50 bg-background/40 px-2 py-1.5 text-xs">
                  <p className="font-medium text-primary">
                    {message.replyTo.senderId === user?._id
                      ? "Bạn"
                      : (replySender?.displayName ?? "Người gửi")}
                  </p>
                  <p className="truncate text-muted-foreground">
                    {message.replyTo.content || (message.replyTo.imgUrl ? "Hình ảnh" : "Tin nhắn")}
                  </p>
                </div>
              )}

              {message.isDeletedForEveryone ? (
                <p className="text-sm italic text-muted-foreground">
                  {deletedMessageLabel}
                </p>
              ) : (
                <>
                  {message.imgUrl && (
                    <img
                      src={message.imgUrl}
                      alt="Message attachment"
                      className="max-h-72 w-auto max-w-full rounded-lg object-cover"
                    />
                  )}
                  {message.content && (
                    <p className="text-sm leading-relaxed break-words">
                      {message.content}
                    </p>
                  )}
                  {message.editedAt && (
                    <p className="text-[11px] italic text-muted-foreground">
                      Đã chỉnh sửa
                    </p>
                  )}
                </>
              )}
            </div>
          </Card>

          {!message.isDeletedForEveryone && reactionBadges.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {reactionBadges.map((reaction) => {
                const reactedByMe = reaction.userIds.includes(user?._id ?? "");
                return (
                  <button
                    key={`${message._id}-${reaction.emoji}`}
                    type="button"
                    onClick={() => void toggleReaction(message._id, reaction.emoji)}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs transition-smooth",
                      reactedByMe
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {reaction.emoji} {reaction.userIds.length}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-1">
            {!message.isDeletedForEveryone && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7 rounded-full">
                    <SmilePlus className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={message.isOwn ? "end" : "start"}>
                  <div className="flex gap-1 px-1 py-1">
                    {reactionOptions.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="rounded-md px-2 py-1 text-lg hover:bg-accent"
                        onClick={() => void toggleReaction(message._id, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 rounded-full"
              onClick={() => setReplyingTo(message)}
            >
              <MessageSquareReply className="size-4" />
            </Button>

            {!message.isDeletedForEveryone && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7 rounded-full">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={message.isOwn ? "end" : "start"}>
                  {canEdit && (
                    <DropdownMenuItem onClick={() => setEditingMessage(message)}>
                      <Pencil className="size-4" />
                      Sửa tin nhắn
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => void deleteMessageForMe(message._id)}>
                    <Trash2 className="size-4" />
                    Thu hồi phía mình
                  </DropdownMenuItem>
                  {canRecallForEveryone && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => void deleteMessageForEveryone(message._id)}
                      >
                        <Heart className="size-4" />
                        Thu hồi cho cả hai bên
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {message.isOwn && message._id === selectedConvo.lastMessage?._id && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs px-1.5 py-0.5 h-4 border-0",
                lastMessageStatus === "seen"
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {lastMessageStatus}
            </Badge>
          )}
        </div>
      </div>
    </>
  );
};

export default MessageItem;
