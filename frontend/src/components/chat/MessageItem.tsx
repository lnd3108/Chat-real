import { cn, formatMessageTime } from "@/lib/utils";
import type { Conversation, Message, Participant } from "@/types/chat";
import { useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import UserAvatar from "./UserAvatar";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";
import {
  Heart,
  Loader2,
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
  const [pendingAction, setPendingAction] = useState<
    "reaction" | "delete-me" | "delete-all" | null
  >(null);
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
  const canEdit =
    message.isOwn && !message.isDeletedForEveryone && message.type !== "system";
  const canRecallForEveryone =
    message.isOwn && !message.isDeletedForEveryone && message.type !== "system";
  const reactionBadges = (message.reactions ?? []).filter(
    (reaction) => reaction.userIds.length > 0,
  );
  const deletedMessageLabel = message.isOwn
    ? "Bạn đã xóa một tin nhắn"
    : `${participant?.displayName ?? "Người dùng"} đã xóa một tin nhắn`;
  const isBusy = pendingAction !== null;
  const isDeletingImage =
    !!message.imgUrl &&
    (pendingAction === "delete-me" || pendingAction === "delete-all");
  const lastMessageStatusLabel =
    lastMessageStatus === "seen" ? "Đã xem" : "Đã gửi";
  const replyPreviewLabel = message.replyTo?.isDeletedForEveryone
    ? "Tin nhắn này đã bị thu hồi"
    : message.replyTo?.content || (message.replyTo?.imgUrl ? "Hình ảnh" : "Tin nhắn");

  const handleJumpToReplyMessage = () => {
    const replyMessageId = message.replyTo?.messageId;
    if (!replyMessageId) return;

    const target = document.getElementById(`message-${replyMessageId}`);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("ring-2", "ring-primary/60", "ring-offset-2", "ring-offset-background");

    window.setTimeout(() => {
      target.classList.remove(
        "ring-2",
        "ring-primary/60",
        "ring-offset-2",
        "ring-offset-background",
      );
    }, 1800);
  };

  const handleToggleReaction = async (emoji: string) => {
    if (isBusy) return;

    try {
      setPendingAction("reaction");
      await toggleReaction(message._id, emoji);
    } finally {
      setPendingAction(null);
    }
  };

  const handleDeleteForMe = async () => {
    if (isBusy) return;

    try {
      setPendingAction("delete-me");
      await deleteMessageForMe(message._id);
    } finally {
      setPendingAction(null);
    }
  };

  const handleDeleteForEveryone = async () => {
    if (isBusy) return;

    try {
      setPendingAction("delete-all");
      await deleteMessageForEveryone(message._id);
    } finally {
      setPendingAction(null);
    }
  };

  if (message.type === "system") {
    return (
      <>
        {isShowTime && (
          <div className="my-3 flex w-full justify-center">
            <span className="rounded-full bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
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
        <div className="my-3 flex w-full justify-center">
          <span className="rounded-full bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
            {formatMessageTime(new Date(message.createdAt))}
          </span>
        </div>
      )}

      <div
        id={`message-${message._id}`}
        className={cn(
          "group/message message-bounce mt-1 flex gap-2 rounded-xl transition-shadow",
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
            "flex max-w-xs flex-col space-y-1 lg:max-w-md",
            message.isOwn ? "items-end" : "items-start",
          )}
        >
          <div
            className={cn(
              "flex items-end gap-1.5",
              message.isOwn ? "flex-row-reverse" : "flex-row",
            )}
          >
            <Card
              className={cn(
                "p-3",
                message.isOwn ? "chat-bubble-sent border-0" : "chat-bubble-received",
              )}
            >
              <div className="space-y-2">
                {message.replyTo && (
                  <button
                    type="button"
                    onClick={handleJumpToReplyMessage}
                    className="w-full rounded-lg border border-border/50 bg-background/40 px-2 py-1.5 text-left text-xs transition-colors hover:bg-background/55"
                  >
                    <p className="font-medium text-primary">
                      {message.replyTo.senderId === user?._id
                        ? "Bạn"
                        : replySender?.displayName ?? "Người gửi"}
                    </p>
                    <p className="truncate text-muted-foreground">
                      {replyPreviewLabel}
                    </p>
                  </button>
                )}

                {message.isDeletedForEveryone ? (
                  <p className="text-sm italic text-muted-foreground">
                    {deletedMessageLabel}
                  </p>
                ) : (
                  <>
                    {message.imgUrl && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <button
                            type="button"
                            className="relative overflow-hidden rounded-lg transition-opacity hover:opacity-90 disabled:cursor-wait"
                            aria-label="Phóng to ảnh trong cuộc trò chuyện"
                            disabled={isDeletingImage}
                          >
                            <img
                              src={message.imgUrl}
                              alt="Ảnh đính kèm trong tin nhắn"
                              className="max-h-72 w-auto max-w-full cursor-zoom-in rounded-lg object-cover"
                            />
                            {isDeletingImage && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-black/55 text-white backdrop-blur-[1px]">
                                <Loader2 className="size-5 animate-spin" />
                                <span className="text-xs font-medium">
                                  Đang xóa ảnh...
                                </span>
                              </div>
                            )}
                          </button>
                        </DialogTrigger>
                        <DialogContent
                          className="max-h-[100vh] w-screen max-w-screen border-0 bg-black/95 p-0 shadow-none"
                          showCloseButton={false}
                        >
                          <DialogTitle className="sr-only">
                            Ảnh trong cuộc trò chuyện
                          </DialogTitle>
                          <DialogDescription className="sr-only">
                            Xem phóng to ảnh được gửi trong tin nhắn.
                          </DialogDescription>
                          <img
                            src={message.imgUrl}
                            alt="Ảnh đính kèm được phóng to"
                            className="h-screen w-screen object-contain"
                          />
                        </DialogContent>
                      </Dialog>
                    )}
                    {message.content && (
                      <p className="break-words text-sm leading-relaxed">
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

            <div
              className={cn(
                "flex items-center gap-0.5 rounded-full bg-background/80 px-1 py-0.5 shadow-sm backdrop-blur-sm transition-all duration-150",
                isBusy
                  ? "opacity-100"
                  : "pointer-events-none translate-x-1 opacity-0 group-hover/message:pointer-events-auto group-hover/message:translate-x-0 group-hover/message:opacity-100 group-focus-within/message:pointer-events-auto group-focus-within/message:translate-x-0 group-focus-within/message:opacity-100",
              )}
            >
              {!message.isDeletedForEveryone && (
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-full"
                          disabled={isBusy}
                        >
                          {pendingAction === "reaction" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <SmilePlus className="size-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top">Bày tỏ cảm xúc</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align={message.isOwn ? "end" : "start"}>
                    <div className="flex gap-1 px-1 py-1">
                      {reactionOptions.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="rounded-md px-2 py-1 text-lg hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void handleToggleReaction(emoji)}
                          disabled={isBusy}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full"
                    disabled={isBusy}
                    onClick={() => setReplyingTo(message)}
                  >
                    <MessageSquareReply className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Trả lời</TooltipContent>
              </Tooltip>

              {!message.isDeletedForEveryone && (
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-full"
                          disabled={isBusy}
                        >
                          {pendingAction === "delete-me" || pendingAction === "delete-all" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="size-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top">Xem thêm</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align={message.isOwn ? "end" : "start"}>
                    {canEdit && (
                      <DropdownMenuItem
                        onClick={() => setEditingMessage(message)}
                        disabled={isBusy}
                      >
                        <Pencil className="size-4" />
                        Sửa tin nhắn
                      </DropdownMenuItem>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          disabled={isBusy}
                        >
                          <Trash2 className="size-4" />
                          Thu hồi phía mình
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent size="sm">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Thu hồi tin nhắn?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tin nhắn sẽ chỉ biến mất ở phía bạn.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => void handleDeleteForMe()}
                            disabled={isBusy}
                          >
                            {pendingAction === "delete-me" ? (
                              <>
                                <Loader2 className="size-4 animate-spin" />
                                Đang xóa...
                              </>
                            ) : (
                              "Xác nhận xóa"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {canRecallForEveryone && (
                      <>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={(e) => e.preventDefault()}
                              disabled={isBusy}
                            >
                              <Heart className="size-4" />
                              Thu hồi cho cả hai bên
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent size="sm">
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Thu hồi cho cả hai bên?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Người còn lại sẽ thấy trạng thái tin nhắn đã bị thu hồi.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                onClick={() => void handleDeleteForEveryone()}
                                disabled={isBusy}
                              >
                                {pendingAction === "delete-all" ? (
                                  <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Đang thu hồi...
                                  </>
                                ) : (
                                  "Xác nhận xóa"
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {!message.isDeletedForEveryone && reactionBadges.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {reactionBadges.map((reaction) => {
                const reactedByMe = reaction.userIds.includes(user?._id ?? "");
                return (
                  <button
                    key={`${message._id}-${reaction.emoji}`}
                    type="button"
                    onClick={() => void handleToggleReaction(reaction.emoji)}
                    disabled={isBusy}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs transition-smooth disabled:cursor-not-allowed disabled:opacity-70",
                      reactedByMe
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {pendingAction === "reaction" ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <>
                        {reaction.emoji} {reaction.userIds.length}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {message.isOwn && message._id === selectedConvo.lastMessage?._id && (
            <Badge
              variant="outline"
              className={cn(
                "h-4 border-0 px-1.5 py-0.5 text-xs",
                lastMessageStatus === "seen"
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {lastMessageStatusLabel}
            </Badge>
          )}
        </div>
      </div>
    </>
  );
};

export default MessageItem;
