import axios from "@/lib/axios";
import { getParticipantId, getParticipantProfile } from "@/lib/chatParticipants";
import {
  notifyIncomingMessage,
  shouldStoreNotification,
} from "@/lib/messageNotifications";
import { playSound } from "@/lib/sound";
import type { SocketState } from "@/types/store";
import type { DirectBlockInfo, Participant } from "@/types/chat";
import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";
import { useFriendStore } from "./useFriendStore";
import { useNotificationStore } from "./useNotificationStore";
import { toast } from "sonner";

const baseURL = import.meta.env.VITE_SOCKET_URL;
const SHOW_ONLINE_STATUS_KEY = "pref:showOnlineStatus";
type SocketConnectError = Error & { data?: { code?: string } };

const getStoredShowOnlineStatus = () => {
  const raw = localStorage.getItem(SHOW_ONLINE_STATUS_KEY);
  return raw === null ? true : raw === "true";
};

const isDocumentVisible = () =>
  typeof document !== "undefined" &&
  document.visibilityState === "visible" &&
  document.hasFocus();

const mergeDirectBlockInfo = (
  current: DirectBlockInfo | undefined = {
    blockedByMe: false,
    blockedByOther: false,
    blockerId: null,
    blockedUserId: null,
    canSendMessage: true,
  },
  meId: string | undefined,
  payload: {
    blockerId: string;
    blockedUserId: string;
    isBlocked: boolean;
  },
) => {
  const nextBlockedByMe =
    payload.blockerId === meId ? payload.isBlocked : current.blockedByMe;
  const nextBlockedByOther =
    payload.blockedUserId === meId ? payload.isBlocked : current.blockedByOther;

  return {
    blockedByMe: nextBlockedByMe,
    blockedByOther: nextBlockedByOther,
    blockerId:
      nextBlockedByMe
        ? meId ?? payload.blockerId
        : nextBlockedByOther
          ? payload.blockerId
          : null,
    blockedUserId:
      nextBlockedByMe
        ? payload.blockedUserId
        : nextBlockedByOther
          ? meId ?? payload.blockedUserId
          : null,
    canSendMessage: !nextBlockedByMe && !nextBlockedByOther,
  };
};

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  onlineUsers: [],
  showOnlineStatus: getStoredShowOnlineStatus(),
  connectSocket: () => {
    const accessToken = useAuthStore.getState().accessToken;
    const existingSocket = get().socket;

    if (!accessToken) return;

    if (existingSocket) {
      existingSocket.auth = { ...existingSocket.auth, token: accessToken };

      if (!existingSocket.connected) {
        existingSocket.connect();
      }

      return;
    }

    const socket: Socket = io(baseURL, {
      auth: { token: accessToken },
      transports: ["websocket"],
      autoConnect: true,
    });

    set({ socket });

    let isRefreshingSocketAuth = false;

    socket.on("connect", () => {
      isRefreshingSocketAuth = false;
      console.log("Kết nối socket thành công");
      socket.emit("preferences:showOnlineStatus", get().showOnlineStatus);
      socket.emit(
        "conversation:active",
        isDocumentVisible() ? useChatStore.getState().activeConversationId : null,
      );
    });

    socket.on("connect_error", async (error: SocketConnectError) => {
      if (error?.message) {
        console.warn("Lỗi kết nối socket:", error.message);
      }

      if (error?.data?.code !== "TOKEN_EXPIRED" || isRefreshingSocketAuth) {
        return;
      }

      isRefreshingSocketAuth = true;

      try {
        await useAuthStore.getState().refresh();
        const newAccessToken = useAuthStore.getState().accessToken;

        if (!newAccessToken) {
          socket.disconnect();
          set({ socket: null, onlineUsers: [] });
          return;
        }

        socket.auth = { ...socket.auth, token: newAccessToken };
        socket.connect();
      } catch (refreshError) {
        console.error("Không thể làm mới token cho socket:", refreshError);
        socket.disconnect();
        set({ socket: null, onlineUsers: [] });
      } finally {
        isRefreshingSocketAuth = false;
      }
    });

    socket.on("online-users", (userIds) => {
      set({ onlineUsers: userIds });
    });

    socket.on("new-message", ({ message, conversation, unreadCounts }) => {
      const {
        addConvo,
        addMessage,
        activeConversationId,
        conversations,
        fetchConversations,
        fetchMessages,
        markasSeen,
        messages,
        setActiveConversation,
        updateConversation,
      } = useChatStore.getState();
      const { user } = useAuthStore.getState();
      const targetConversationId = conversation?._id ?? message.conversationId;
      const hasConversation = conversations.some(
        (item) => item._id === targetConversationId,
      );
      const isCurrentConversation = activeConversationId === message.conversationId;
      const isCurrentConversationVisible = isCurrentConversation && isDocumentVisible();
      const senderParticipant = conversation?.participants?.find(
        (participant: Participant) => getParticipantId(participant) === message.senderId,
      );
      const senderProfile = getParticipantProfile(senderParticipant);

      if (conversation?.participants?.length) {
        addConvo(conversation, { activate: false });
        socket.emit("join-conversation", conversation._id);
      } else if (!hasConversation) {
        void fetchConversations();
      }

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
              imgUrl: payloadLastMessage.imgUrl ?? message?.imgUrl ?? null,
              isDeletedForEveryone:
                payloadLastMessage.isDeletedForEveryone ??
                message?.isDeletedForEveryone ??
                false,
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

      updateConversation({
        _id: conversation?._id ?? message.conversationId,
        type: conversation?.type,
        group: conversation?.group,
        participants: conversation?.participants,
        unreadCounts,
        seenBy: conversation?.seenBy,
        lastMessageAt:
          conversation?.lastMessageAt ??
          lastMessage?.createdAt ??
          message?.createdAt,
        moveToTop: true,
        ...(lastMessage ? { lastMessage } : {}),
      });
      void addMessage(message);

      if (isCurrentConversationVisible) {
        void markasSeen(message.conversationId);
      }

      if (message.senderId === user?._id) {
        return;
      }

      if (
        shouldStoreNotification("new_message", {
          conversation,
          conversationId: message.conversationId,
        })
      ) {
        useNotificationStore.getState().addNotification({
        id: `message-${message._id}`,
        type: "new_message",
        title: "Tin nhắn mới",
        message: `${senderProfile?.displayName ?? "Ai đó"} vừa gửi tin nhắn cho bạn`,
        actorName: senderProfile?.displayName,
        entityId: message._id,
        conversationId: message.conversationId,
        messageId: message._id,
        });
      }

      if (isCurrentConversationVisible) {
        return;
      }

      const openConversation = async () => {
        setActiveConversation(message.conversationId);

        if (!messages[message.conversationId]) {
          await fetchMessages(message.conversationId);
        }

        if (isDocumentVisible()) {
          await markasSeen(message.conversationId);
        }
      };

      playSound("notification");
      notifyIncomingMessage({
        conversation,
        message,
        currentUserId: user?._id,
        onOpenConversation: () => {
          void openConversation();
        },
      });
    });

    socket.on("message:updated", ({ message, conversation }) => {
      useChatStore.getState().updateMessage(message);
      if (conversation) {
        useChatStore.getState().updateConversation({
          _id: conversation._id,
          unreadCounts: conversation.unreadCounts,
          seenBy: conversation.seenBy,
          lastMessage: conversation.lastMessage,
          lastMessageAt: conversation.lastMessageAt,
          moveToTop: false,
        });
      }
    });

    socket.on("message:removed-for-me", ({ conversationId, messageId }) => {
      useChatStore.getState().removeMessageForMe(conversationId, messageId);
    });

    socket.on("read-message", ({ conversation }) => {
      useChatStore.getState().updateConversation({
        _id: conversation._id,
        unreadCounts: conversation.unreadCounts,
        seenBy: conversation.seenBy,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        moveToTop: false,
      });
    });

    socket.on("new-group", (conversation) => {
      useChatStore.getState().addConvo(conversation, { activate: false });
      socket.emit("join-conversation", conversation._id);
    });

    socket.on("conversation:deleted", ({ conversationId }) => {
      useChatStore.getState().removeConversationLocal(conversationId);
      if (shouldStoreNotification("conversation_deleted")) {
        useNotificationStore.getState().addNotification({
        id: `conversation-deleted-${conversationId}-${Date.now()}`,
        type: "conversation_deleted",
        title: "Cuộc trò chuyện đã bị xóa",
        message: "Một cuộc trò chuyện đã bị xóa khỏi danh sách của bạn",
        entityId: conversationId,
        });
      }
    });

    socket.on("conversation:direct-cleared", ({ conversationId }) => {
      useChatStore.getState().removeConversationLocal(conversationId);
    });

    socket.on("friend:removed", ({ userId, targetUserId }) => {
      const currentUserId = useAuthStore.getState().user?._id;
      if (!currentUserId) {
        return;
      }

      const removedFriendId = userId === currentUserId ? targetUserId : userId;
      if (!removedFriendId) {
        return;
      }

      useFriendStore.setState((state) => ({
        friends: state.friends.filter((friend) => friend._id !== removedFriendId),
        suggestions: state.suggestions.map((user) =>
          user._id === removedFriendId
            ? {
                ...user,
                isFriend: false,
                requestSent: false,
                requestReceived: false,
              }
            : user,
        ),
        receivedList: state.receivedList.filter((request) => request.from?._id !== removedFriendId),
        sentList: state.sentList.filter((request) => request.to?._id !== removedFriendId),
      }));
    });

    socket.on("conversation:left", ({ conversationId, groupName, removedByOther }) => {
      useChatStore.getState().removeConversationLocal(conversationId);
      if (shouldStoreNotification("conversation_removed")) {
        useNotificationStore.getState().addNotification({
        id: `conversation-left-${conversationId}-${Date.now()}`,
        type: "conversation_removed",
        title: removedByOther ? "Bạn đã bị xóa khỏi nhóm" : "Bạn đã rời nhóm",
        message: removedByOther
          ? `Bạn đã bị xóa khỏi ${groupName ?? "nhóm"}`
          : `Bạn đã rời ${groupName ?? "nhóm"}`,
        entityId: conversationId,
        });
      }
      toast.message(
        removedByOther
          ? `Bạn đã bị xóa khỏi ${groupName ?? "nhóm"}`
          : `Bạn đã rời ${groupName ?? "nhóm"}`,
      );
    });

    socket.on("conversation:member-left", ({ conversationId, userId }) => {
      const { conversations, setConversationParticipants } = useChatStore.getState();
      const conversation = conversations.find((c) => c._id === conversationId);
      if (!conversation) return;

      const participants = conversation.participants.filter(
        (participant) => getParticipantId(participant) !== userId,
      );

      setConversationParticipants(conversationId, participants);
      toast.message("Một thành viên đã rời nhóm");
    });

    socket.on("conversation:member-removed", ({ conversationId, memberId }) => {
      const { conversations, setConversationParticipants } = useChatStore.getState();
      const conversation = conversations.find((c) => c._id === conversationId);
      if (!conversation) return;

      const participants = conversation.participants.filter(
        (participant) => getParticipantId(participant) !== memberId,
      );

      setConversationParticipants(conversationId, participants);
      toast.message("Một thành viên đã bị xóa khỏi nhóm");
    });

    socket.on("conversation:members-added", ({ conversationId, participants }) => {
      useChatStore.getState().setConversationParticipants(conversationId, participants);
      toast.message("Nhóm vừa có thêm thành viên mới");
    });
    socket.on("conversation:updated", ({ conversation }) => {
      useChatStore.getState().updateConversation({
        _id: conversation._id,
        group: conversation.group,
        participants: conversation.participants,
        moveToTop: false,
      });
    });
    socket.on("direct:block-status", ({ conversationId, blockerId, blockedUserId, isBlocked }) => {
      if (!conversationId || !blockerId || !blockedUserId) {
        return;
      }

      const meId = useAuthStore.getState().user?._id;
      const currentConversation = useChatStore
        .getState()
        .conversations.find((conversation) => conversation._id === conversationId);

      useChatStore.getState().updateConversation({
        _id: conversationId,
        blockInfo: mergeDirectBlockInfo(currentConversation?.blockInfo, meId, {
          blockerId,
          blockedUserId,
          isBlocked,
        }),
        moveToTop: false,
      });
    });
    socket.on("added-to-group", ({ groupName }) => {
      if (shouldStoreNotification("added_to_group")) {
        useNotificationStore.getState().addNotification({
        id: `added-to-group-${groupName}-${Date.now()}`,
        type: "added_to_group",
        title: "Bạn được thêm vào nhóm",
        message: `Bạn vừa được thêm vào ${groupName}`,
        });
      }
      toast.success(`Bạn vừa được thêm vào ${groupName}`);
    });
  },

  loadShowOnlineStatus: async () => {
    try {
      const res = await axios.get("/users/me");
      const value = res.data?.user?.preferences?.showOnlineStatus ?? true;

      localStorage.setItem(SHOW_ONLINE_STATUS_KEY, String(value));
      set({ showOnlineStatus: value });
    } catch (error) {
      console.error("Không thể tải trạng thái hiển thị online:", error);
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

  emitActiveConversation: (conversationId) => {
    const socket = get().socket;
    if (!socket) return;
    socket.emit("conversation:active", conversationId);
  },

  disconnectSocket: () => {
    const socket = get().socket;

    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },
}));


