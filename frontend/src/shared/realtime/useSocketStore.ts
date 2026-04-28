import axios from "@/shared/api/axios";
import { AdminRoleSocketHandler } from "@/features/admin/realtime/AdminRoleSocketHandler";
import { AccountSocketHandler } from "@/features/auth/realtime/AccountSocketHandler";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { ChatSocketHandler } from "@/features/chat/realtime/ChatSocketHandler";
import { FriendSocketHandler } from "@/features/friend/realtime/FriendSocketHandler";
import { NotificationSocketHandler } from "@/features/notification/realtime/NotificationSocketHandler";
import { createSocketClient } from "@/shared/realtime/SocketClient";
import { SocketLifecycleService } from "@/shared/realtime/SocketLifecycleService";
import type { SocketState } from "@/shared/types/store";
import type { Socket } from "socket.io-client";
import { create } from "zustand";
import { logger } from "@/shared/lib/logger";

const SHOW_ONLINE_STATUS_KEY = "pref:showOnlineStatus";
type SocketConnectError = Error & { data?: { code?: string } };

const getStoredShowOnlineStatus = () => {
  const raw = localStorage.getItem(SHOW_ONLINE_STATUS_KEY);
  return raw === null ? true : raw === "true";
};

export const useSocketStore = create<SocketState>((set, get) => {
  const chatHandler = new ChatSocketHandler({
    getShowOnlineStatus: () => get().showOnlineStatus,
    setOnlineUsers: (userIds) => set({ onlineUsers: userIds }),
  });
  const accountHandler = new AccountSocketHandler({
    clearSocketState: () => {
      const socket = get().socket;
      if (socket) {
        lifecycleService.unregister(socket);
      }
      set({ socket: null, onlineUsers: [] });
    },
  });
  const lifecycleService = new SocketLifecycleService(
    chatHandler,
    new FriendSocketHandler(),
    accountHandler,
    new AdminRoleSocketHandler(),
    new NotificationSocketHandler(),
  );

  let isRefreshingSocketAuth = false;

  const clearSocket = (socket?: Socket | null) => {
    const targetSocket = socket ?? get().socket;
    if (targetSocket) {
      lifecycleService.unregister(targetSocket);
      targetSocket.off("connect_error", handleConnectError);
    }
    set({ socket: null, onlineUsers: [] });
  };

  const handleConnectError = async (error: SocketConnectError) => {
    const socket = get().socket;

    if (error?.message) {
      logger.warn("Lỗi kết nối socket", { message: error.message });
    }

    if (error?.data?.code === "ACCOUNT_BANNED") {
      accountHandler.forceLogoutForBannedAccount(error.message);
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
        socket?.disconnect();
        clearSocket(socket);
        return;
      }

      if (socket) {
        socket.auth = { ...socket.auth, token: newAccessToken };
        socket.connect();
      }
    } catch (refreshError) {
      logger.error("Không thể làm mới token cho socket", {
        message:
          refreshError instanceof Error
            ? refreshError.message
            : String(refreshError),
      });
      socket?.disconnect();
      clearSocket(socket);
    } finally {
      isRefreshingSocketAuth = false;
    }
  };

  return {
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

      const socket = createSocketClient(accessToken);
      set({ socket });

      lifecycleService.register(socket);
      socket.off("connect_error", handleConnectError);
      socket.on("connect_error", handleConnectError);
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
      if (!socket) return;

      clearSocket(socket);
      socket.io.opts.reconnection = false;
      socket.disconnect();
    },
  };
});
