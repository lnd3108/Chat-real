import {
  ADMIN_SOCKET_EVENTS,
  SOCKET_ROOMS,
  USER_SOCKET_EVENTS,
} from "../../domain/constants/socket-events.js";
import { hasAdminPanelAccess } from "../../domain/rbac/access-policy.js";
import { emitGlobal } from "./socket-gateway.js";
import { getIo } from "./socket-registry.js";

const socketsByUser = new Map();
const visibleByUser = new Map();
const activeConversationBySocket = new Map();
const userMetaByUser = new Map();

export const registerSocketConnection = ({ userId, socketId, visible, userMeta }) => {
  if (!socketsByUser.has(userId)) {
    socketsByUser.set(userId, new Set());
  }

  const socketIds = socketsByUser.get(userId);
  const wasOffline = !socketIds || socketIds.size === 0;

  socketsByUser.get(userId).add(socketId);
  visibleByUser.set(userId, visible);
  activeConversationBySocket.set(socketId, null);
  userMetaByUser.set(userId, userMeta);

  return { wasOffline };
};

export const unregisterSocketConnection = ({ userId, socketId }) => {
  const currentSocketIds = socketsByUser.get(userId);
  let becameOffline = false;

  if (currentSocketIds) {
    currentSocketIds.delete(socketId);

    if (currentSocketIds.size === 0) {
      socketsByUser.delete(userId);
      visibleByUser.delete(userId);
      userMetaByUser.delete(userId);
      becameOffline = true;
    }
  }

  activeConversationBySocket.delete(socketId);
  return { becameOffline };
};

export const setConversationActiveForSocket = (socketId, conversationId) => {
  activeConversationBySocket.set(socketId, conversationId);
};

export const setUserVisibility = (userId, visible) => {
  visibleByUser.set(userId, visible);
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

export const getOnlineVisibleUserIds = () => {
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

export const emitOnlineUsers = () => {
  emitGlobal("online-users", getOnlineVisibleUserIds());
};

export const emitAdminUserPresence = ({ buildSocketUserPayload, eventType, user, isOnline }) => {
  if (hasAdminPanelAccess(user)) {
    return;
  }

  getIo().to(SOCKET_ROOMS.ADMINS).emit(ADMIN_SOCKET_EVENTS.USER_STATUS_CHANGED, {
    eventType,
    userId: user._id.toString(),
    isOnline,
    status: isOnline ? "online" : "offline",
    user: buildSocketUserPayload(user),
    changedAt: new Date().toISOString(),
  });
};

export const disconnectUserSockets = (userId) => {
  const normalizedUserId = userId?.toString();
  const socketIds = socketsByUser.get(normalizedUserId);

  if (!normalizedUserId || !socketIds || socketIds.size === 0) {
    return;
  }

  const io = getIo();
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

export const disconnectAllNonAdminSockets = (message = "He thong dang bao tri") => {
  const io = getIo();

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
