import { cn, formatMessageTime } from "@/lib/utils";
import type { Conversation, Message, Participant } from "@/types/chat";
import UserAvatar from "./UserAvatar";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";

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
  const prev = index + 1 < messages.length ? messages[index + 1] : undefined;

  const isShowTime =
    index === 0 ||
    new Date(message.createdAt).getTime() -
      new Date(prev?.createdAt || 0).getTime() >
      300000;

  const isGroupBreak = isShowTime || message.senderId !== prev?.senderId;

  const participant = selectedConvo.participants.find(
    (p: Participant) => p._id?.toString() === message.senderId?.toString(),
  );

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
            </div>
          </Card>

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
