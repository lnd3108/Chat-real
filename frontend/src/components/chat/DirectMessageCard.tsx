import type { Conversation } from "@/types/chat";
import ChatCard from "./ChatCard";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { cn } from "@/lib/utils";
import UserAvatar from "./UserAvatar";
import StatusBadge from "./StatusBadge";
import UnreadCountBadge from "./UnreadCountBadge";
import { useSocketStore } from "@/stores/useSocketStore";

const DirectMessageCard = ({ convo }: { convo: Conversation }) => {
  const { user } = useAuthStore();
  const {
    activeConversationId,
    setActiveConversation,
    messages,
    fetchMessages,
  } = useChatStore();
  const { onlineUsers } = useSocketStore();

  if (!user) return null;

  // const otherUser = convo.participants.find((p) => p._id !== user._id);
  const getId = (p: any) =>
    typeof p?.userId === "string" ? p.userId : p?.userId?._id ?? p?._id;

  const getUserObj = (p: any) =>
    p?.userId && typeof p.userId === "object" ? p.userId : p;

  const otherRaw = convo.participants.find((p: any) => getId(p) !== user._id);
  const otherUser = otherRaw ? getUserObj(otherRaw) : null;
  if (!otherUser) return null;

  const otherId = String(getId(otherRaw));

  const unreadCount = convo.unreadCounts?.[user._id] ?? 0;
  const lastMessage = convo.lastMessage?.content ?? "";

  const handleSelectConversation = async (id: string) => {
    setActiveConversation(id);
    if (!messages[id]) {
      await fetchMessages();
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
          {/* todo: socket io */}
          <StatusBadge
            status={onlineUsers.includes(otherId) ? "online" : "offline"}
          />
          {unreadCount > 0 && <UnreadCountBadge unreadCount={unreadCount} />}
        </>
      }
      subtitle={
        <p
          className={cn(
            "text-sm truncate",
            unreadCount > 0
              ? "font-medium text-foreground"
              : "text-muted-foreground"
          )}
        >
          {lastMessage}
        </p>
      }
    />
  );
};

export default DirectMessageCard;
