import { useEffect } from "react";

import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";

import ChatWelcomeScreen from "./ChatWelcomeScreen";
import ChatWindowSkeleton from "../skeleton/ChatWindowSkeleton";
import { SidebarInset } from "../ui/sidebar";
import ChatWindowHeader from "./ChatWindowHeader";
import ChatWindowBody from "./ChatWindowBody";
import MessageInput from "./MessageInput";

const isConversationVisible = () =>
  typeof document !== "undefined" &&
  document.visibilityState === "visible" &&
  document.hasFocus();

const ChatWindowLayout = () => {
  const {
    activeConversationId,
    conversations,
    messageLoading: loading,
    markasSeen,
    setEditingMessage,
    setReplyingTo,
  } = useChatStore();
  const emitActiveConversation = useSocketStore((state) => state.emitActiveConversation);

  const selectedConvo =
    conversations.find((conversation) => conversation._id === activeConversationId) ?? null;

  useEffect(() => {
    setEditingMessage(null);
    setReplyingTo(null);
  }, [activeConversationId, setEditingMessage, setReplyingTo]);

  useEffect(() => {
    const syncActiveConversation = () => {
      const currentConversationId = isConversationVisible() ? activeConversationId : null;
      emitActiveConversation(currentConversationId);

      if (currentConversationId) {
        void markasSeen(currentConversationId);
      }
    };

    syncActiveConversation();

    if (typeof window === "undefined") {
      return;
    }

    window.addEventListener("focus", syncActiveConversation);
    window.addEventListener("blur", syncActiveConversation);
    document.addEventListener("visibilitychange", syncActiveConversation);

    return () => {
      window.removeEventListener("focus", syncActiveConversation);
      window.removeEventListener("blur", syncActiveConversation);
      document.removeEventListener("visibilitychange", syncActiveConversation);
      emitActiveConversation(null);
    };
  }, [activeConversationId, emitActiveConversation, markasSeen]);

  useEffect(() => {
    if (!selectedConvo || !activeConversationId || !selectedConvo.lastMessage?._id) {
      return;
    }

    if (!isConversationVisible()) {
      return;
    }

    void markasSeen(activeConversationId);
  }, [activeConversationId, markasSeen, selectedConvo, selectedConvo?.lastMessage?._id]);

  if (!selectedConvo) {
    return <ChatWelcomeScreen />;
  }

  if (loading) {
    return <ChatWindowSkeleton />;
  }

  return (
    <SidebarInset className="flex h-full flex-col overflow-hidden rounded-sm shadow-md">
      <ChatWindowHeader chat={selectedConvo} />

      <div className="flex-1 overflow-y-auto bg-primary-foreground">
        <ChatWindowBody />
      </div>

      <MessageInput selectedConvo={selectedConvo} />
    </SidebarInset>
  );
};

export default ChatWindowLayout;
