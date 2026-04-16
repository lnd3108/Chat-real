import { useChatStore } from "@/stores/useChatStore";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import MessageItem from "./MessageItem";
import { useLayoutEffect, useRef } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import InfiniteScroll from "react-infinite-scroll-component";
import { getLastMessageSenderId, normalizeSeenUser } from "@/lib/chatParticipants";

const ChatWindowBody = () => {
  const {
    activeConversationId,
    conversations,
    messages: allMessages,
    fetchMessages,
  } = useChatStore();
  const currentUserId = useAuthStore((state) => state.user?._id);

  const messages = allMessages[activeConversationId!]?.items ?? [];
  const reversedMessages = [...messages].reverse();
  const hasMore = allMessages[activeConversationId!]?.hasMore ?? false;
  const key = `chat-scroll-${activeConversationId}`;
  const selectedConvo = conversations.find((c) => c._id === activeConversationId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const lastMessage = selectedConvo?.lastMessage;
  const lastSenderId = getLastMessageSenderId(lastMessage);
  const seenByOther = Boolean(
    currentUserId &&
      selectedConvo?.seenBy?.some((seenUser) => normalizeSeenUser(seenUser)._id !== currentUserId),
  );
  const lastMessageStatus: "delivered" | "seen" =
    currentUserId && lastMessage && lastSenderId === currentUserId && seenByOther
      ? "seen"
      : "delivered";

  useLayoutEffect(() => {
    if (!messagesEndRef.current) {
      return;
    }

    messagesEndRef.current.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [activeConversationId]);

  const fetchMoreMessages = async () => {
    if (!activeConversationId) {
      return;
    }

    try {
      await fetchMessages(activeConversationId);
    } catch (error) {
      console.error("Loi xay ra khi fetch them tin", error);
    }
  };

  const handleScrollSave = () => {
    const container = containerRef.current;
    if (!container || !activeConversationId) {
      return;
    }

    sessionStorage.setItem(
      key,
      JSON.stringify({
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
      }),
    );
  };

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const item = sessionStorage.getItem(key);

    if (item) {
      const { scrollTop } = JSON.parse(item) as { scrollTop: number };
      requestAnimationFrame(() => {
        container.scrollTop = scrollTop;
      });
    }
  }, [key, messages.length]);

  if (!selectedConvo) {
    return <ChatWelcomeScreen />;
  }

  if (!messages.length) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Chua co tin nhan nao trong cuoc tro chuyen nay.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-primary-foreground p-4">
      <div
        id="scrollableDiv"
        ref={containerRef}
        onScroll={handleScrollSave}
        className="beautiful-scroll-bar flex flex-col-reverse overflow-x-hidden overflow-y-auto"
      >
        <div ref={messagesEndRef} />
        <InfiniteScroll
          dataLength={messages.length}
          next={fetchMoreMessages}
          hasMore={hasMore}
          scrollableTarget="scrollableDiv"
          loader={<p>Dang tai...</p>}
          inverse={true}
          style={{
            display: "flex",
            flexDirection: "column-reverse",
            overflow: "visible",
          }}
        >
          {reversedMessages.map((message, index) => (
            <MessageItem
              key={message._id ?? index}
              message={message}
              index={index}
              messages={reversedMessages}
              selectedConvo={selectedConvo}
              lastMessageStatus={lastMessageStatus}
            />
          ))}
        </InfiniteScroll>
      </div>
    </div>
  );
};

export default ChatWindowBody;
