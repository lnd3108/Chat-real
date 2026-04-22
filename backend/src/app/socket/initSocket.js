import { Server } from "socket.io";

import { getUserConversationIdsForRealtime } from "../../modules/chat/application/conversation.query-service.js";
import { socketAuthMiddleWare } from "../../modules/identity/api/socket/socket-auth.middleware.js";
import {
  ADMIN_SOCKET_EVENTS,
  SOCKET_ROOMS,
  USER_SOCKET_EVENTS,
} from "../../shared/domain/constants/socket-events.js";
import {
  hasAdminPanelAccess,
  serializeUserAccess,
} from "../../shared/domain/rbac/access-policy.js";
import User from "../../models/User.js";
import { emitDashboardStatsUpdated } from "../../services/dashboardRealtimeService.js";

let io;

const socketsByUser = new Map();
const visibleByUser = new Map();
const activeConversationBySocket = new Map();
const userMetaByUser = new Map();

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

const getOnlineVisibleUserIds = () => {
  const userIds = [];

  for (const [userId, socketIds] of socketsByUser.entries()) {
    const visible = visibleByUser.get(userId) ?? true;
    const meta = userMetaByUser.get(userId);

    if (socketIds.size > 0 && visible && !hasAdminPanelAccess(meta)) {
      userIds.push(userId);
    }
  }

  return userIds;
};

const emitOnlineUsers = () => {
  if (!io) {
    return;
  }

  io.emit("online-users", getOnlineVisibleUserIds());
};

const emitAdminUserPresence = (eventType, user, isOnline) => {
  if (!io || hasAdminPanelAccess(user)) {
    return;
  }

  io.to(SOCKET_ROOMS.ADMINS).emit(ADMIN_SOCKET_EVENTS.USER_STATUS_CHANGED, {
    eventType,
    userId: user._id.toString(),
    isOnline,
    status: isOnline ? "online" : "offline",
    user: buildSocketUserPayload(user),
    changedAt: new Date().toISOString(),
  });
};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL, credentials: true },
  });

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

    if (!socketsByUser.has(userId)) {
      socketsByUser.set(userId, new Set());
    }

    const socketIds = socketsByUser.get(userId);
    const wasOffline = !socketIds || socketIds.size === 0;

    socketsByUser.get(userId).add(socket.id);
    visibleByUser.set(userId, visible);
    activeConversationBySocket.set(socket.id, null);
    userMetaByUser.set(userId, buildSocketUserPayload(user));

    socket.join(userId);
    if (hasAdminPanelAccess(user)) {
      socket.join(SOCKET_ROOMS.ADMINS);
    }

    emitOnlineUsers();

    if (wasOffline) {
      emitAdminUserPresence(USER_SOCKET_EVENTS.ONLINE, user, true);
      void emitDashboardStatsUpdated({ reason: "user:online", userId });
    }

    const conversations = await getUserConversationIdsForRealtime(user._id);
    conversations.forEach((id) => socket.join(id.toString()));

    socket.on("disconnect", () => {
      const currentSocketIds = socketsByUser.get(userId);
      let becameOffline = false;

      if (currentSocketIds) {
        currentSocketIds.delete(socket.id);

        if (currentSocketIds.size === 0) {
          socketsByUser.delete(userId);
          visibleByUser.delete(userId);
          userMetaByUser.delete(userId);
          becameOffline = true;
        }
      }

      activeConversationBySocket.delete(socket.id);
      emitOnlineUsers();

      if (becameOffline) {
        emitAdminUserPresence(USER_SOCKET_EVENTS.OFFLINE, user, false);
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
      activeConversationBySocket.set(
        socket.id,
        typeof conversationId === "string" && conversationId.trim()
          ? conversationId
          : null,
      );
    });

    socket.on("preferences:showOnlineStatus", (value) => {
      if (typeof value === "boolean") {
        visibleByUser.set(userId, value);
        emitOnlineUsers();
      }
    });
  });

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io has not been initialized. Call initSocket(server) first.");
  }

  return io;
};

export const emitToUser = (userId, eventName, payload) => {
  if (!io || !userId || !eventName) {
    return;
  }

  io.to(userId.toString()).emit(eventName, payload);
};

export const disconnectUserSockets = (userId) => {
  if (!io || !userId) {
    return;
  }

  const normalizedUserId = userId.toString();
  const socketIds = socketsByUser.get(normalizedUserId);

  if (!socketIds || socketIds.size === 0) {
    return;
  }

  [...socketIds].forEach((socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      activeConversationBySocket.delete(socketId);
      return;
    }

    socket.disconnect(true);
  });

  socketsByUser.delete(normalizedUserId);
  visibleByUser.delete(normalizedUserId);
  userMetaByUser.delete(normalizedUserId);
  emitOnlineUsers();
};

export const isConversationActiveForUser = (userId, conversationId) => {
  const socketIds = socketsByUser.get(userId?.toString());
  if (!socketIds || socketIds.size === 0 || !conversationId) {
    return false;
  }

  for (const socketId of socketIds) {
    if (activeConversationBySocket.get(socketId) === conversationId.toString()) {
      return true;
    }
  }

  return false;
};

export const disconnectAllUserSockets = (message = "He thong dang bao tri") => {
  if (!io) {
    return;
  }

  io.sockets.sockets.forEach((socket) => {
    if (socket.user && !hasAdminPanelAccess(socket.user)) {
      socket.emit(USER_SOCKET_EVENTS.SYSTEM_MAINTENANCE_ON, { message });
      socket.emit(USER_SOCKET_EVENTS.MAINTENANCE_MODE_LEGACY, { message });
      socket.disconnect(true);
    }
  });

  for (const [userId] of socketsByUser.entries()) {
    socketsByUser.delete(userId);
    visibleByUser.delete(userId);
    userMetaByUser.delete(userId);
  }

  for (const socketId of activeConversationBySocket.keys()) {
    activeConversationBySocket.delete(socketId);
  }

  emitOnlineUsers();
};

export const getOnlineUsersCount = () => getOnlineVisibleUserIds().length;
