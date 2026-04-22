import { Server } from "socket.io";

import { getUserConversationIdsForRealtime } from "../../modules/chat/application/conversation.query-service.js";
import { socketAuthMiddleWare } from "../../modules/identity/api/socket/socket-auth.middleware.js";
import { SOCKET_ROOMS, USER_SOCKET_EVENTS } from "../../shared/domain/constants/socket-events.js";
import {
  hasAdminPanelAccess,
  serializeUserAccess,
} from "../../shared/domain/rbac/access-policy.js";
import {
  disconnectAllNonAdminSockets,
  disconnectUserSockets as disconnectUserSocketsFromPresence,
  emitAdminUserPresence,
  emitOnlineUsers,
  getOnlineUsersCount,
  registerSocketConnection,
  setConversationActiveForSocket,
  setUserVisibility,
  unregisterSocketConnection,
  isConversationActiveForUser,
} from "../../shared/infrastructure/realtime/user-presence.js";
import { emitToUser } from "../../shared/infrastructure/realtime/socket-gateway.js";
import { getIo, setIo } from "../../shared/infrastructure/realtime/socket-registry.js";
import User from "../../models/User.js";
import { emitDashboardStatsUpdated } from "../../services/dashboardRealtimeService.js";

const buildSocketUserPayload = (user) => {
  const userAccess = serializeUserAccess(user);

  return {
    _id: user._id,
    displayName: user.displayName,
    userName: user.userName,
    email: user.email ?? null,
    avatarUrl: user.avatarUrl ?? null,
    role: userAccess.role,
    roleLabel: userAccess.roleLabel,
    roleLevel: userAccess.roleLevel,
    permissions: userAccess.permissions,
    status: user.status ?? "active",
    createdAt: user.createdAt ?? null,
  };
};

export const initSocket = (server) => {
  const io = setIo(
    new Server(server, {
      cors: { origin: process.env.CLIENT_URL, credentials: true },
    }),
  );

  io.use(socketAuthMiddleWare);

  io.on("connection", async (socket) => {
    const user = socket.user;
    const userId = user._id.toString();

    let visible = user?.preferences?.showOnlineStatus;
    if (typeof visible !== "boolean") {
      const dbUser = await User.findById(userId).select("preferences.showOnlineStatus");
      visible = dbUser?.preferences?.showOnlineStatus;
    }
    if (typeof visible !== "boolean") {
      visible = true;
    }

    const userMeta = buildSocketUserPayload(user);
    const { wasOffline } = registerSocketConnection({
      userId,
      socketId: socket.id,
      visible,
      userMeta,
    });

    socket.join(userId);
    if (hasAdminPanelAccess(user)) {
      socket.join(SOCKET_ROOMS.ADMINS);
    }

    emitOnlineUsers();

    if (wasOffline) {
      emitAdminUserPresence({
        buildSocketUserPayload,
        eventType: USER_SOCKET_EVENTS.ONLINE,
        user,
        isOnline: true,
      });
      void emitDashboardStatsUpdated({ reason: "user:online", userId });
    }

    const conversations = await getUserConversationIdsForRealtime(user._id);
    conversations.forEach((id) => socket.join(id.toString()));

    socket.on("disconnect", () => {
      const { becameOffline } = unregisterSocketConnection({
        userId,
        socketId: socket.id,
      });
      emitOnlineUsers();

      if (becameOffline) {
        emitAdminUserPresence({
          buildSocketUserPayload,
          eventType: USER_SOCKET_EVENTS.OFFLINE,
          user,
          isOnline: false,
        });
        void emitDashboardStatsUpdated({ reason: "user:offline", userId });
      }
    });

    socket.on("join-conversation", (conversationId) => {
      socket.join(conversationId);
    });

    socket.on("leave-conversation", (conversationId) => {
      socket.leave(conversationId);
    });

    socket.on("conversation:active", (conversationId) => {
      setConversationActiveForSocket(
        socket.id,
        typeof conversationId === "string" && conversationId.trim()
          ? conversationId
          : null,
      );
    });

    socket.on("preferences:showOnlineStatus", (value) => {
      if (typeof value === "boolean") {
        setUserVisibility(userId, value);
        emitOnlineUsers();
      }
    });
  });

  return io;
};

export {
  emitToUser,
  getIo,
  getOnlineUsersCount,
  isConversationActiveForUser,
};

export const disconnectUserSockets = (userId) =>
  disconnectUserSocketsFromPresence(userId);

export const disconnectAllUserSockets = (message = "He thong dang bao tri") =>
  disconnectAllNonAdminSockets(message);
