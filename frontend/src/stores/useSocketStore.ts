import axios from "@/lib/axios";
import type { SocketState } from "@/types/store";
import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";
import { toast } from "sonner";

const baseURL = import.meta.env.VITE_SOCKET_URL;
const SHOW_ONLINE_STATUS_KEY = "pref:showOnlineStatus";

const getStoredShowOnlineStatus = () => {
  const raw = localStorage.getItem(SHOW_ONLINE_STATUS_KEY);
  return raw === null ? true : raw === "true";
};

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  onlineUsers: [],
  showOnlineStatus: getStoredShowOnlineStatus(),
  connectSocket: () => {
    const accessToken = useAuthStore.getState().accessToken;
    const existingSocket = get().socket;

    if (existingSocket) return;

    const socket: Socket = io(baseURL, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });

    set({ socket });

    socket.on("connect", () => {
      console.log("Connected socket successfully");
      socket.emit("preferences:showOnlineStatus", get().showOnlineStatus);
    });

    socket.on("online-users", (userIds) => {
      set({ onlineUsers: userIds });
    });

    socket.on("new-message", ({ message, conversation, unreadCounts }) => {
      useChatStore.getState().addMessage(message);

      const payloadLastMessage = conversation?.lastMessage ?? message;
      const senderId =
        payloadLastMessage?.sender?._id ??
        payloadLastMessage?.senderId ??
        message?.senderId;

      const lastMessage =
        payloadLastMessage?._id && senderId
          ? {
              _id: payloadLastMessage._id,
              content: payloadLastMessage.content ?? null,
              createdAt:
                payloadLastMessage.createdAt ??
                conversation?.lastMessageAt ??
                message?.createdAt,
              sender: payloadLastMessage.sender
                ? {
                    _id: payloadLastMessage.sender._id,
                    displayName: payloadLastMessage.sender.displayName ?? "",
                    avatarUrl: payloadLastMessage.sender.avatarUrl ?? null,
                  }
                : undefined,
              senderId,
            }
          : undefined;

      useChatStore.getState().updateConversation({
        _id: conversation?._id ?? message.conversationId,
        unreadCounts,
        seenBy: conversation?.seenBy,
        lastMessageAt:
          conversation?.lastMessageAt ??
          lastMessage?.createdAt ??
          message?.createdAt,
        ...(lastMessage ? { lastMessage } : {}),
      });

      if (
        useChatStore.getState().activeConversationId === message.conversationId
      ) {
        useChatStore.getState().markasSeen();
      }
    });

    socket.on("read-message", ({ conversation }) => {
      useChatStore.getState().updateConversation({
        _id: conversation._id,
        unreadCounts: conversation.unreadCounts,
        seenBy: conversation.seenBy,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
      });
    });

    socket.on("new-group", (conversation) => {
      useChatStore.getState().addConvo(conversation, { activate: false });
      socket.emit("join-conversation", conversation._id);
    });

    socket.on("conversation:deleted", ({ conversationId }) => {
      useChatStore.getState().removeConversationLocal(conversationId);
    });

    socket.on("conversation:left", ({ conversationId }) => {
      useChatStore.getState().removeConversationLocal(conversationId);
    });

    socket.on("conversation:member-left", ({ conversationId, userId }) => {
      const { conversations, setConversationParticipants } = useChatStore.getState();
      const conversation = conversations.find((c) => c._id === conversationId);
      if (!conversation) return;

      const participants = conversation.participants.filter((p: any) => {
        const participantId =
          typeof p?.userId === "string" ? p.userId : p?.userId?._id ?? p?._id;
        return participantId !== userId;
      });

      setConversationParticipants(conversationId, participants);
      toast.message("Một thành viên đã rời nhóm");
    });

    socket.on("conversation:member-removed", ({ conversationId, memberId }) => {
      const { conversations, setConversationParticipants } = useChatStore.getState();
      const conversation = conversations.find((c) => c._id === conversationId);
      if (!conversation) return;

      const participants = conversation.participants.filter((p: any) => {
        const participantId =
          typeof p?.userId === "string" ? p.userId : p?.userId?._id ?? p?._id;
        return participantId !== memberId;
      });

      setConversationParticipants(conversationId, participants);
      toast.message("Một thành viên đã bị xóa khỏi nhóm");
    });

    socket.on("conversation:members-added", ({ conversationId, participants }) => {
      useChatStore.getState().setConversationParticipants(conversationId, participants);
      toast.message("Nhóm vừa có thêm thành viên mới");
    });
  },

  loadShowOnlineStatus: async () => {
    try {
      const res = await axios.get("/users/me");
      const value = res.data?.user?.preferences?.showOnlineStatus ?? true;

      localStorage.setItem(SHOW_ONLINE_STATUS_KEY, String(value));
      set({ showOnlineStatus: value });
    } catch (error) {
      console.error("Failed to load showOnlineStatus:", error);
    }
  },

  updateShowOnlineStatus: async (value: boolean) => {
    const previous = get().showOnlineStatus;

    set({ showOnlineStatus: value });
    localStorage.setItem(SHOW_ONLINE_STATUS_KEY, String(value));

    try {
      await axios.patch("/users/me/preferences", { showOnlineStatus: value });
      get().emitShowOnlineStatus(value);
    } catch (error) {
      set({ showOnlineStatus: previous });
      localStorage.setItem(SHOW_ONLINE_STATUS_KEY, String(previous));
      throw error;
    }
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
