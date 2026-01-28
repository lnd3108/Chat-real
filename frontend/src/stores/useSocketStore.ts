import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "./useAuthStore";
import type { SocketState } from "@/types/store";
import { useChatStore } from "./useChatStore";

const baseURL = import.meta.env.VITE_SOCKET_URL;

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  onlineUsers: [],
  connectSocket: () => {
    const accessToken = useAuthStore.getState().accessToken;
    const existingSocket = get().socket;

    if (existingSocket) return; // tránh tạo nhièu socket

    const socket: Socket = io(baseURL, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });

    set({ socket });

    socket.on("connect", () => {
      console.log("Đã kết nối thành công với socket");
    });

    //online users
    socket.on("online-users", (userIds) => {
      console.log("online-users received:", userIds);
      set({ onlineUsers: userIds });
    });

    // new message
    socket.on("new-message", ({ message, conversation, unreadCounts }) => {
      useChatStore.getState().addMessage(message);

      const lastMessage = {
        _id: conversation.lastMessage._id,
        content: conversation.lastMessage.content,
        createdAt: conversation.lastMessage.createdAt,
        sender: {
          _id:
            conversation.lastMessage.sender?._id ??
            conversation.lastMessage.senderId,
          displayName: conversation.lastMessage.sender?.displayName ?? "",
          avatarUrl: conversation.lastMessage.sender?.avatarUrl ?? null,
        },
      };

      // const updatedConversation = {
      //   ...conversation,
      //   lastMessage,
      //   unreadCounts,
      // };

      console.log("[new-message] participants:", conversation?.participants);
      console.log(
        "[new-message] first participant:",
        conversation?.participants?.[0],
      );
      console.log("[new-message] unreadCounts:", unreadCounts);

      // if (
      //   useChatStore.getState().activeConversationId === message.conversationId
      // ) {
      //   useChatStore.getState().markasSeen();
      // }

      // useChatStore.getState().updateConversation(updatedConversation);

      useChatStore.getState().updateConversation({
        _id: conversation._id,
        lastMessage,
        unreadCounts,
        seenBy: conversation.seenBy,
        lastMessageAt: conversation.lastMessageAt,
      });

      if (
        useChatStore.getState().activeConversationId === message.conversationId
      ) {
        useChatStore.getState().markasSeen();
      }
    });

    // read message
    socket.on("read-message", ({ conversation }) => {
      useChatStore.getState().updateConversation({
        _id: conversation._id,
        unreadCounts: conversation.unreadCounts,
        seenBy: conversation.seenBy,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
      });

      console.log("[read-message] participants:", conversation?.participants);
    });

    //new Group chat
    socket.on("new-group", (conversation) => {
      useChatStore.getState().addConvo(conversation);
      socket.emit("join-conversation", conversation._id);
    });
  },

  emitShowOnlineStatus: (value: boolean) => {
    const socket = get().socket;
    if (!socket) return;
    socket.emit("preferences:showOnlineStatus", value);
  },

  disconnectSocket: () => {
    const socket = get().socket;

    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },
}));
