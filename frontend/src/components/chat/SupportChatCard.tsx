import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Conversation } from "@/types/chat";
import { useChatStore } from "@/stores/useChatStore";
import { useAuthStore } from "@/stores/useAuthStore";

import ChatCard from "./ChatCard";
import UnreadCountBadge from "./UnreadCountBadge";

const supportStatusLabelMap: Record<string, string> = {
  open: "Mở",
  in_progress: "Đang xử lý",
  resolved: "Đã giải quyết",
  closed: "Đã đóng",
};

const SupportChatCard = ({ convo }: { convo: Conversation }) => {
  const { user } = useAuthStore();
  const { activeConversationId, fetchMessages, messages, setActiveConversation } =
    useChatStore();

  if (!user) {
    return null;
  }

  const unreadCount = convo.unreadCounts?.[user._id] ?? 0;
  const statusLabel = supportStatusLabelMap[convo.supportStatus ?? "open"] ?? "Mở";
  const lastMessagePreview = convo.lastMessage?.content?.trim() || "Chưa có tin nhắn hỗ trợ";

  const handleSelectConversation = async (id: string) => {
    try {
      setActiveConversation(id);
      if (!messages[id]) {
        await fetchMessages(id);
      }
    } catch (error) {
      console.error("Không thể mở cuộc trò chuyện hỗ trợ:", error);
      toast.error("Không thể mở cuộc trò chuyện hỗ trợ lúc này.");
    }
  };

  return (
    <ChatCard
      convoId={convo._id}
      name="Liên hệ hỗ trợ"
      timestamp={
        convo.lastMessage?.createdAt ? new Date(convo.lastMessage.createdAt) : undefined
      }
      isActive={activeConversationId === convo._id}
      onSelect={handleSelectConversation}
      unreadCount={unreadCount}
      leftSection={
        <>
          <div className="relative flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700">
            <LifeBuoy className="size-5" />
          </div>
          {unreadCount > 0 && <UnreadCountBadge unreadCount={unreadCount} />}
        </>
      }
      subtitle={
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-emerald-700">{statusLabel}</p>
          <p
            className={`truncate text-sm ${
              unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            {lastMessagePreview}
          </p>
        </div>
      }
      actions={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(event) => {
            event.stopPropagation();
            void handleSelectConversation(convo._id);
          }}
        >
          <LifeBuoy className="size-4 text-muted-foreground" />
        </Button>
      }
    />
  );
};

export default SupportChatCard;
