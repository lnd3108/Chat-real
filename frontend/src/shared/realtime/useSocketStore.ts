import axios from "@/shared/api/axios";
import { registerChatSocketHandler } from "@/features/chat/realtime/ChatSocketHandler";
import { shouldStoreNotification } from "@/features/notification/lib/messageNotifications";
import type { SocketState } from "@/shared/types/store";
import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import { useFriendStore } from "@/features/friend/stores/useFriendStore";
import { useNotificationStore } from "@/features/notification/stores/useNotificationStore";
import { toast } from "sonner";
import { hasAdminPanelAccess } from "@/shared/lib/rbac";
import { logger } from "@/shared/lib/logger";

const baseURL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") ||
  window.location.origin;
const SHOW_ONLINE_STATUS_KEY = "pref:showOnlineStatus";
type SocketConnectError = Error & { data?: { code?: string } };

let cleanupChatSocketHandler: (() => void) | null = null;

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
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    set({ socket });

    cleanupChatSocketHandler?.();
    cleanupChatSocketHandler = registerChatSocketHandler(socket, {
      getShowOnlineStatus: () => get().showOnlineStatus,
      setOnlineUsers: (userIds) => set({ onlineUsers: userIds }),
    });

    let isRefreshingSocketAuth = false;
    const forceLogoutForBannedAccount = (message?: string) => {
      const { clearState } = useAuthStore.getState();
      const { reset } = useChatStore.getState();

      clearState();
      reset();
      cleanupChatSocketHandler?.();
      cleanupChatSocketHandler = null;
      socket.io.opts.reconnection = false;
      socket.disconnect();
      set({ socket: null, onlineUsers: [] });

      if (typeof window !== "undefined") {
        toast.error(message || "Tài khoản của bạn đã bị khóa.");
        window.location.href = "/signin";
      }
    };

    socket.on("connect_error", async (error: SocketConnectError) => {
      if (error?.message) {
        logger.warn("Lỗi kết nối socket", { message: error.message });
      }

      if (error?.data?.code === "ACCOUNT_BANNED") {
        forceLogoutForBannedAccount(error.message);
        return;
      }

      if (error?.data?.code !== "TOKEN_EXPIRED" || isRefreshingSocketAuth) {
        return;
      }

      isRefreshingSocketAuth = true;

      try {
        await useAuthStore.getState().refresh();
        const newAccessToken = useAuthStore.getState().accessToken;

        if (!newAccessToken) {
          cleanupChatSocketHandler?.();
          cleanupChatSocketHandler = null;
          socket.disconnect();
          set({ socket: null, onlineUsers: [] });
          return;
        }

        socket.auth = { ...socket.auth, token: newAccessToken };
        socket.connect();
      } catch (refreshError) {
        logger.error("Không thể làm mới token cho socket", {
          message:
            refreshError instanceof Error
              ? refreshError.message
              : String(refreshError),
        });
        cleanupChatSocketHandler?.();
        cleanupChatSocketHandler = null;
        socket.disconnect();
        set({ socket: null, onlineUsers: [] });
      } finally {
        isRefreshingSocketAuth = false;
      }
    });

    socket.on("friend:request:received", ({ request }) => {
      if (!request?._id || !request?.from?._id) {
        return;
      }

      useFriendStore.setState((state) => ({
        receivedList: state.receivedList.some((item) => item._id === request._id)
          ? state.receivedList
          : [request, ...state.receivedList],
        suggestions: state.suggestions.map((user) =>
          user._id === request.from._id
            ? {
                ...user,
                isFriend: false,
                requestSent: false,
                requestReceived: true,
              }
            : user,
        ),
      }));

      if (shouldStoreNotification("friend_request")) {
        useNotificationStore.getState().addNotification({
          id: `friend-request-${request._id}`,
          type: "friend_request",
          title: "Lời mời kết bạn mới",
          message: `${request.from.displayName ?? "Ai đó"} đã gửi lời mời kết bạn cho bạn`,
          actorName: request.from.displayName,
          entityId: request._id,
          createdAt: request.createdAt,
        });
      }
    });

    socket.on("friend:request:sent", ({ request }) => {
      if (!request?._id || !request?.to?._id) {
        return;
      }

      useFriendStore.setState((state) => ({
        sentList: state.sentList.some((item) => item._id === request._id)
          ? state.sentList
          : [request, ...state.sentList],
        suggestions: state.suggestions.map((user) =>
          user._id === request.to._id
            ? {
                ...user,
                isFriend: false,
                requestSent: true,
                requestReceived: false,
              }
            : user,
        ),
      }));
    });

    socket.on("friend:request:accepted", ({ requestId, userA, userB }) => {
      const currentUserId = useAuthStore.getState().user?._id;
      if (!currentUserId || !userA?._id || !userB?._id) {
        return;
      }

      const otherUser = userA._id === currentUserId ? userB : userA;
      if (!otherUser?._id) {
        return;
      }

      useFriendStore.setState((state) => ({
        friends: state.friends.some((friend) => friend._id === otherUser._id)
          ? state.friends
          : [otherUser, ...state.friends],
        suggestions: state.suggestions.map((user) =>
          user._id === otherUser._id
            ? {
                ...user,
                isFriend: true,
                requestSent: false,
                requestReceived: false,
              }
            : user,
        ),
        receivedList: state.receivedList.filter(
          (request) =>
            request._id !== requestId && request.from?._id !== otherUser._id,
        ),
        sentList: state.sentList.filter(
          (request) =>
            request._id !== requestId && request.to?._id !== otherUser._id,
        ),
      }));

      useNotificationStore.getState().removeNotificationByEntity(requestId);
    });

    socket.on("friend:request:removed", ({ requestId, fromUserId, toUserId }) => {
      const currentUserId = useAuthStore.getState().user?._id;
      if (!currentUserId) {
        return;
      }

      const otherUserId = currentUserId === fromUserId ? toUserId : fromUserId;
      if (!otherUserId) {
        return;
      }

      useFriendStore.setState((state) => ({
        receivedList: state.receivedList.filter((request) => request._id !== requestId),
        sentList: state.sentList.filter((request) => request._id !== requestId),
        suggestions: state.suggestions.map((user) =>
          user._id === otherUserId
            ? {
                ...user,
                isFriend: false,
                requestSent: false,
                requestReceived: false,
              }
            : user,
        ),
      }));

      useNotificationStore.getState().removeNotificationByEntity(requestId);
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
        receivedList: state.receivedList.filter(
          (request) => request.from?._id !== removedFriendId,
        ),
        sentList: state.sentList.filter(
          (request) => request.to?._id !== removedFriendId,
        ),
      }));
    });

    socket.on("account:deleted", () => {
      const { clearState } = useAuthStore.getState();
      const { reset } = useChatStore.getState();

      clearState();
      reset();
      get().disconnectSocket();
    });

    socket.on("account:banned", ({ message } = { message: undefined }) => {
      forceLogoutForBannedAccount(message);
    });

    socket.on("user:role-updated", ({ user, reason }) => {
      const currentUser = useAuthStore.getState().user;
      if (!currentUser || !user?._id || currentUser._id !== user._id) {
        return;
      }

      useAuthStore.getState().setUser({
        ...currentUser,
        ...user,
      });

      if (!hasAdminPanelAccess(user) && window.location.pathname.startsWith("/admin")) {
        toast.warning(reason || "Quyền admin của bạn đã bị thu hồi.");
      } else {
        toast.success(
          reason || "Quyền tài khoản của bạn đã được cập nhật.",
        );
      }
    });
  },

  loadShowOnlineStatus: async () => {
    try {
      const res = await axios.get("/users/me");
      const value = res.data?.user?.preferences?.showOnlineStatus ?? true;

      localStorage.setItem(SHOW_ONLINE_STATUS_KEY, String(value));
      set({ showOnlineStatus: value });
    } catch (error) {
      logger.warn("Không thể tải trạng thái hiển thị online", {
        message: error instanceof Error ? error.message : String(error),
      });
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
      cleanupChatSocketHandler?.();
      cleanupChatSocketHandler = null;
      socket.off("connect_error");
      socket.off("friend:request:received");
      socket.off("friend:request:sent");
      socket.off("friend:request:accepted");
      socket.off("friend:request:removed");
      socket.off("friend:removed");
      socket.off("account:deleted");
      socket.off("account:banned");
      socket.off("user:role-updated");
      socket.io.opts.reconnection = false;
      socket.disconnect();
      set({ socket: null, onlineUsers: [] });
    }
  },
}));
