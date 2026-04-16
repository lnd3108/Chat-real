import { useChatStore } from "@/stores/useChatStore";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import ChatWindowSkeleton from "../skeleton/ChatWindowSkeleton";
import { SidebarInset } from "../ui/sidebar";
import ChatWindowHeader from "./ChatWindowHeader";
import ChatWindowBody from "./ChatWindowBody";
import MessageInput from "./MessageInput";
import { useEffect } from "react";

const ChatWindowLayout = () => {
  const {
    activeConversationId,
    conversations,
    messageLoading: loading,
    markasSeen,
    setEditingMessage,
    setReplyingTo,
  } = useChatStore();

  const selectedConvo =
    conversations.find((c) => c._id === activeConversationId) ?? null;

  useEffect(() => {
    setEditingMessage(null);
    setReplyingTo(null);
  }, [activeConversationId, setEditingMessage, setReplyingTo]);

  useEffect(() => {
    if (!selectedConvo) {
      return;
    }

     const isVisible =
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      document.hasFocus();

    if (!isVisible) {
      return;
    }

    const markSeen = async () => {
      try {
        await markasSeen();
      } catch (error) {
        console.error("Lỗi khi markSeen", error);
      }
    };

    if (!activeConversationId || !selectedConvo?.lastMessage?._id) return;
    markSeen();
  }, [activeConversationId, markasSeen, selectedConvo, selectedConvo?.lastMessage?._id]);

  if (!selectedConvo) {
    return <ChatWelcomeScreen />;
  }

  if (loading) {
    return <ChatWindowSkeleton />;
  }

  return (
    <SidebarInset className="flex flex-col h-full overflow-hidden rounded-sm shadow-md">
      {/* Header */}
      <ChatWindowHeader chat={selectedConvo} />

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-primary-foreground">
        <ChatWindowBody />
      </div>

      {/* Footer */}
      <MessageInput selectedConvo={selectedConvo} />
    </SidebarInset>
  );
};

export default ChatWindowLayout;
