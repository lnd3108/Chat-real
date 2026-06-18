import {
  ADMIN_SOCKET_EVENTS,
  SOCKET_ROOMS,
  USER_SOCKET_EVENTS,
} from "../../domain/constants/socket-events.js";
import { hasAdminPanelAccess } from "../../domain/rbac/access-policy.js";
import { buildKey } from "../cache/cache.service.js";
import {
  getRedisClient,
  isRedisEnabled,
  isRedisReady,
} from "../redis/redis-client.js";
import { emitGlobal } from "./socket-gateway.js";
import { getIo } from "./socket-registry.js";

const socketsByUser = new Map();
const visibleByUser = new Map();
const activeConversationBySocket = new Map();
const userMetaByUser = new Map();

const DEFAULT_PRESENCE_TTL_SECONDS = 120;
const DEFAULT_PRESENCE_PRUNE_LIMIT = 100;

const isPresenceRedisEnabled = () =>
  process.env.PRESENCE_REDIS_ENABLED === "true" && isRedisEnabled();

const isPresenceDebugEnabled = () =>
  process.env.PRESENCE_DEBUG_ENABLED === "true";

const getPresenceTtlSeconds = () => {
  const value = Number(process.env.PRESENCE_TTL_SECONDS);
  return Number.isInteger(value) && value > 0
    ? value
    : DEFAULT_PRESENCE_TTL_SECONDS;
};

const debugPresence = (event, data = {}) => {
  if (!isPresenceDebugEnabled()) {
    return;
  }

  console.log("[PresenceDebug]", {
    event,
    ...data,
  });
};

const getRedisOrNull = () => {
  if (!isPresenceRedisEnabled() || !isRedisReady()) {
    return null;
  }

  return getRedisClient();
};

const getRedisForCleanup = async () => {
  if (!isRedisEnabled()) {
    return null;
  }

  const client = getRedisClient();
  if (!client) {
    return null;
  }

  if (client.status !== "ready") {
    await client.connect();
  }

  return client;
};

const keyUserSockets = (userId) =>
  buildKey("presence", "user", userId, "sockets");
const keySocketUser = (socketId) =>
  buildKey("presence", "socket", socketId, "user");
const keySocketConversation = (socketId) =>
  buildKey("presence", "socket", socketId, "conversation");
const keyUserVisible = (userId) =>
  buildKey("presence", "user", userId, "visible");
const keyUserMeta = (userId) => buildKey("presence", "user", userId, "meta");
const keyOnlineUsers = () => buildKey("presence", "users", "online");
const keyVisibleUsers = () => buildKey("presence", "users", "visible");

const toUserId = (value) => value?.toString?.() ?? String(value ?? "");

const extractBetween = (value, marker, suffix = "") => {
  const start = value.indexOf(marker);
  if (start < 0) {
    return null;
  }

  const valueStart = start + marker.length;
  const valueEnd = suffix ? value.lastIndexOf(suffix) : value.length;
  if (valueEnd < valueStart) {
    return null;
  }

  return value.slice(valueStart, valueEnd);
};

const isVisibleNonAdmin = (visible, userMeta) =>
  visible !== false && !hasAdminPanelAccess(userMeta);

const cleanupRedisUserPresence = async (client, userId) => {
  const pipeline = client.pipeline();
  pipeline.del(keyUserSockets(userId));
  pipeline.del(keyUserVisible(userId));
  pipeline.del(keyUserMeta(userId));
  pipeline.srem(keyOnlineUsers(), userId);
  pipeline.srem(keyVisibleUsers(), userId);
  await pipeline.exec();
};

const rememberLocalSocket = ({ userId, socketId, visible, userMeta }) => {
  if (!socketsByUser.has(userId)) {
    socketsByUser.set(userId, new Set());
  }

  const socketIds = socketsByUser.get(userId);
  const wasOffline = !socketIds || socketIds.size === 0;

  socketIds.add(socketId);
  visibleByUser.set(userId, visible);
  activeConversationBySocket.set(socketId, null);
  userMetaByUser.set(userId, userMeta);

  return { wasOffline };
};

const forgetLocalSocket = ({ userId, socketId }) => {
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

const pruneRedisUserSockets = async (client, userId) => {
  const socketsKey = keyUserSockets(userId);
  const socketIds = await client.smembers(socketsKey);

  if (socketIds.length === 0) {
    await cleanupRedisUserPresence(client, userId);
    return 0;
  }

  const socketUserKeys = socketIds.map(keySocketUser);
  const reverseUserIds = await client.mget(...socketUserKeys);
  const staleSocketIds = socketIds.filter(
    (_, index) => reverseUserIds[index] !== userId,
  );

  if (staleSocketIds.length > 0) {
    await client.srem(socketsKey, ...staleSocketIds);
    const staleConversationKeys = staleSocketIds.map(keySocketConversation);
    if (staleConversationKeys.length > 0) {
      await client.del(...staleConversationKeys);
    }
  }

  const remaining = await client.scard(socketsKey);
  if (remaining === 0) {
    await cleanupRedisUserPresence(client, userId);
  }

  debugPresence("prune-user", {
    staleSockets: staleSocketIds.length,
    remaining,
  });

  return remaining;
};

const pruneRedisPresenceUsers = async (
  client,
  userIds,
  limit = DEFAULT_PRESENCE_PRUNE_LIMIT,
) => {
  const uniqueUserIds = [...new Set(userIds)].filter(Boolean);
  const prunedUserIds = [];

  for (const userId of uniqueUserIds.slice(0, limit)) {
    if ((await pruneRedisUserSockets(client, userId)) > 0) {
      prunedUserIds.push(userId);
    }
  }

  return prunedUserIds;
};

const scanRedisKeys = async ({ client, pattern, limit, batchSize = 100 }) => {
  let cursor = "0";
  const keys = [];

  do {
    const [nextCursor, matchedKeys] = await client.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      batchSize,
    );
    cursor = nextCursor;

    keys.push(...matchedKeys);
  } while (cursor !== "0" && keys.length < limit);

  return keys.slice(0, limit);
};

export const cleanupStalePresence = async ({
  limit = DEFAULT_PRESENCE_PRUNE_LIMIT,
  dryRun = false,
} = {}) => {
  const client = await getRedisForCleanup();
  const boundedLimit = Number.isInteger(limit) && limit > 0 ? limit : 100;
  const stats = {
    scannedUsers: 0,
    scannedSockets: 0,
    removedUsers: 0,
    removedSockets: 0,
    removedAggregateUsers: 0,
    dryRun: Boolean(dryRun),
  };

  if (!client) {
    return stats;
  }

  const userSocketKeys = await scanRedisKeys({
    client,
    pattern: buildKey("presence", "user", "*", "sockets"),
    limit: boundedLimit,
  });

  for (const socketsKey of userSocketKeys) {
    const userId = extractBetween(socketsKey, ":presence:user:", ":sockets");
    if (!userId) {
      continue;
    }

    stats.scannedUsers += 1;
    const socketIds = await client.smembers(socketsKey);

    if (socketIds.length === 0) {
      stats.removedUsers += 1;
      if (!dryRun) {
        await cleanupRedisUserPresence(client, userId);
      }
      continue;
    }

    const reverseUserIds = await client.mget(...socketIds.map(keySocketUser));
    const staleSocketIds = socketIds.filter(
      (_, index) => reverseUserIds[index] !== userId,
    );

    if (staleSocketIds.length > 0) {
      stats.removedSockets += staleSocketIds.length;

      if (!dryRun) {
        const pipeline = client.pipeline();
        pipeline.srem(socketsKey, ...staleSocketIds);
        pipeline.del(...staleSocketIds.map(keySocketConversation));
        await pipeline.exec();
      }
    }

    const remaining = dryRun
      ? socketIds.length - staleSocketIds.length
      : await client.scard(socketsKey);
    if (remaining === 0) {
      stats.removedUsers += 1;
      if (!dryRun) {
        await cleanupRedisUserPresence(client, userId);
      }
    }
  }

  const socketUserKeys = await scanRedisKeys({
    client,
    pattern: buildKey("presence", "socket", "*", "user"),
    limit: boundedLimit,
  });

  for (const socketUserKey of socketUserKeys) {
    const socketId = extractBetween(socketUserKey, ":presence:socket:", ":user");
    if (!socketId) {
      continue;
    }

    stats.scannedSockets += 1;
    const userId = await client.get(socketUserKey);
    if (!userId || !(await client.sismember(keyUserSockets(userId), socketId))) {
      stats.removedSockets += 1;

      if (!dryRun) {
        await client.del(socketUserKey, keySocketConversation(socketId));
      }
    }
  }

  const aggregateUserIds = [
    ...new Set([
      ...(await client.smembers(keyOnlineUsers())),
      ...(await client.smembers(keyVisibleUsers())),
    ]),
  ].slice(0, boundedLimit);

  for (const userId of aggregateUserIds) {
    const remaining = dryRun
      ? await client.scard(keyUserSockets(userId))
      : await pruneRedisUserSockets(client, userId);

    if (remaining === 0) {
      stats.removedAggregateUsers += 1;
      if (!dryRun) {
        await cleanupRedisUserPresence(client, userId);
      }
      continue;
    }

    const [visibleValue, metaValue] = await client.mget(
      keyUserVisible(userId),
      keyUserMeta(userId),
    );
    let userMeta = null;
    try {
      userMeta = metaValue ? JSON.parse(metaValue) : null;
    } catch {
      userMeta = null;
    }

    if (!isVisibleNonAdmin(visibleValue !== "0", userMeta)) {
      stats.removedAggregateUsers += 1;
      if (!dryRun) {
        await client.srem(keyVisibleUsers(), userId);
      }
    }
  }

  return stats;
};

const setRedisUserVisibility = async ({ userId, visible, userMeta }) => {
  const client = getRedisOrNull();
  if (!client) {
    return false;
  }

  const ttl = getPresenceTtlSeconds();
  const visibleValue = visible === false ? "0" : "1";
  const metaValue = JSON.stringify(userMeta ?? null);
  const onlineSocketCount = await pruneRedisUserSockets(client, userId);

  if (onlineSocketCount === 0) {
    return false;
  }

  const pipeline = client.pipeline();
  pipeline.set(keyUserVisible(userId), visibleValue, "EX", ttl);
  pipeline.set(keyUserMeta(userId), metaValue, "EX", ttl);

  if (isVisibleNonAdmin(visible, userMeta)) {
    pipeline.sadd(keyVisibleUsers(), userId);
  } else {
    pipeline.srem(keyVisibleUsers(), userId);
  }

  await pipeline.exec();
  return true;
};

export const registerSocketConnection = async ({
  userId,
  socketId,
  visible,
  userMeta,
}) => {
  const normalizedUserId = toUserId(userId);
  const localResult = rememberLocalSocket({
    userId: normalizedUserId,
    socketId,
    visible,
    userMeta,
  });

  const client = getRedisOrNull();
  if (!client) {
    return localResult;
  }

  try {
    const socketsKey = keyUserSockets(normalizedUserId);
    const socketCountBefore = await pruneRedisUserSockets(
      client,
      normalizedUserId,
    );
    const ttl = getPresenceTtlSeconds();

    const pipeline = client.pipeline();
    pipeline.sadd(socketsKey, socketId);
    pipeline.expire(socketsKey, ttl);
    pipeline.set(keySocketUser(socketId), normalizedUserId, "EX", ttl);
    pipeline.sadd(keyOnlineUsers(), normalizedUserId);
    pipeline.set(
      keyUserVisible(normalizedUserId),
      visible === false ? "0" : "1",
      "EX",
      ttl,
    );
    pipeline.set(
      keyUserMeta(normalizedUserId),
      JSON.stringify(userMeta ?? null),
      "EX",
      ttl,
    );

    if (isVisibleNonAdmin(visible, userMeta)) {
      pipeline.sadd(keyVisibleUsers(), normalizedUserId);
    } else {
      pipeline.srem(keyVisibleUsers(), normalizedUserId);
    }

    await pipeline.exec();
    debugPresence("register", {
      wasOffline: socketCountBefore === 0,
      visible: visible !== false,
    });
    return { wasOffline: socketCountBefore === 0 };
  } catch (error) {
    console.warn("[Presence] Redis register failed:", error.message);
    return localResult;
  }
};

export const unregisterSocketConnection = async ({ userId, socketId }) => {
  const normalizedUserId = toUserId(userId);
  const localResult = forgetLocalSocket({
    userId: normalizedUserId,
    socketId,
  });

  const client = getRedisOrNull();
  if (!client) {
    return localResult;
  }

  try {
    const socketsKey = keyUserSockets(normalizedUserId);
    const pipeline = client.pipeline();
    pipeline.srem(socketsKey, socketId);
    pipeline.del(keySocketUser(socketId));
    pipeline.del(keySocketConversation(socketId));
    await pipeline.exec();

    const remaining = await pruneRedisUserSockets(client, normalizedUserId);
    if (remaining === 0) {
      await cleanupRedisUserPresence(client, normalizedUserId);
    }

    debugPresence("unregister", {
      becameOffline: remaining === 0,
      remaining,
    });
    return { becameOffline: remaining === 0 };
  } catch (error) {
    console.warn("[Presence] Redis unregister failed:", error.message);
    return localResult;
  }
};

export const refreshSocketPresence = async ({ userId, socketId, userMeta }) => {
  const client = getRedisOrNull();
  if (!client) {
    return false;
  }

  try {
    const normalizedUserId = toUserId(userId);
    const ttl = getPresenceTtlSeconds();
    const pipeline = client.pipeline();
    pipeline.sadd(keyOnlineUsers(), normalizedUserId);
    pipeline.expire(keyUserSockets(normalizedUserId), ttl);
    pipeline.expire(keyUserVisible(normalizedUserId), ttl);
    pipeline.expire(keyUserMeta(normalizedUserId), ttl);
    pipeline.expire(keySocketUser(socketId), ttl);
    pipeline.expire(keySocketConversation(socketId), ttl);
    if (userMeta !== undefined) {
      pipeline.set(
        keyUserMeta(normalizedUserId),
        JSON.stringify(userMeta ?? null),
        "EX",
        ttl,
      );
    }
    await pipeline.exec();
    return true;
  } catch (error) {
    console.warn("[Presence] Redis refresh failed:", error.message);
    return false;
  }
};

export const setConversationActiveForSocket = async (
  socketId,
  conversationId,
) => {
  activeConversationBySocket.set(socketId, conversationId);

  const client = getRedisOrNull();
  if (!client) {
    return;
  }

  try {
    if (conversationId) {
      await client.set(
        keySocketConversation(socketId),
        conversationId.toString(),
        "EX",
        getPresenceTtlSeconds(),
      );
      return;
    }

    await client.del(keySocketConversation(socketId));
  } catch (error) {
    console.warn("[Presence] Redis active conversation failed:", error.message);
  }
};

export const setUserVisibility = async (userId, visible) => {
  const normalizedUserId = toUserId(userId);
  visibleByUser.set(normalizedUserId, visible);
  const userMeta = userMetaByUser.get(normalizedUserId);

  try {
    await setRedisUserVisibility({
      userId: normalizedUserId,
      visible,
      userMeta,
    });
  } catch (error) {
    console.warn("[Presence] Redis visibility failed:", error.message);
  }
};

export const isConversationActiveForUser = async (userId, conversationId) => {
  const normalizedUserId = toUserId(userId);
  if (!normalizedUserId || !conversationId) {
    return false;
  }

  const client = getRedisOrNull();
  if (client) {
    try {
      if ((await pruneRedisUserSockets(client, normalizedUserId)) === 0) {
        return false;
      }

      const socketIds = await client.smembers(keyUserSockets(normalizedUserId));
      if (socketIds.length === 0) {
        return false;
      }

      const activeConversationKeys = socketIds.map(keySocketConversation);
      const activeConversations = await client.mget(...activeConversationKeys);
      return activeConversations.some(
        (activeConversationId) =>
          activeConversationId === conversationId.toString(),
      );
    } catch (error) {
      console.warn("[Presence] Redis active lookup failed:", error.message);
    }
  }

  const socketIds = socketsByUser.get(normalizedUserId);
  if (!socketIds || socketIds.size === 0) {
    return false;
  }

  for (const socketId of socketIds) {
    if (
      activeConversationBySocket.get(socketId) === conversationId.toString()
    ) {
      return true;
    }
  }

  return false;
};

export const getOnlineVisibleUserIds = async () => {
  const client = getRedisOrNull();
  if (client) {
    try {
      const userIds = await client.smembers(keyVisibleUsers());
      const onlineUserIds = await pruneRedisPresenceUsers(client, userIds);
      return onlineUserIds.sort();
    } catch (error) {
      console.warn("[Presence] Redis visible users lookup failed:", error.message);
    }
  }

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

export const isUserOnline = async (userId) => {
  const normalizedUserId = toUserId(userId);
  const client = getRedisOrNull();
  if (client) {
    try {
      return (await pruneRedisUserSockets(client, normalizedUserId)) > 0;
    } catch (error) {
      console.warn("[Presence] Redis online lookup failed:", error.message);
    }
  }

  const socketIds = socketsByUser.get(normalizedUserId);
  return Boolean(socketIds && socketIds.size > 0);
};

export const emitOnlineUsers = async () => {
  emitGlobal("online-users", await getOnlineVisibleUserIds());
};

export const emitAdminUserPresence = ({
  buildSocketUserPayload,
  eventType,
  user,
  isOnline,
}) => {
  if (hasAdminPanelAccess(user)) {
    return;
  }

  getIo()
    .to(SOCKET_ROOMS.ADMINS)
    .emit(ADMIN_SOCKET_EVENTS.USER_STATUS_CHANGED, {
      eventType,
      userId: user._id.toString(),
      isOnline,
      status: isOnline ? "online" : "offline",
      user: buildSocketUserPayload(user),
      changedAt: new Date().toISOString(),
    });
};

export const disconnectUserSockets = (userId) => {
  const normalizedUserId = toUserId(userId);
  if (!normalizedUserId) {
    return;
  }

  const io = getIo();
  io.in(normalizedUserId).disconnectSockets(true);

  const socketIds = socketsByUser.get(normalizedUserId);
  if (socketIds) {
    socketIds.forEach((socketId) => activeConversationBySocket.delete(socketId));
  }

  socketsByUser.delete(normalizedUserId);
  visibleByUser.delete(normalizedUserId);
  userMetaByUser.delete(normalizedUserId);

  const client = getRedisOrNull();
  if (client) {
    void client
      .smembers(keyUserSockets(normalizedUserId))
      .then((socketIdsForUser) => {
        const pipeline = client
          .pipeline()
          .del(keyUserSockets(normalizedUserId))
          .del(keyUserVisible(normalizedUserId))
          .del(keyUserMeta(normalizedUserId))
          .srem(keyOnlineUsers(), normalizedUserId)
          .srem(keyVisibleUsers(), normalizedUserId);

        const socketUserKeys = socketIdsForUser.map(keySocketUser);
        const socketConversationKeys = socketIdsForUser.map(
          keySocketConversation,
        );

        if (socketUserKeys.length > 0) {
          pipeline.del(...socketUserKeys);
        }

        if (socketConversationKeys.length > 0) {
          pipeline.del(...socketConversationKeys);
        }

        return pipeline.exec();
      })
      .catch((error) => {
        console.warn("[Presence] Redis disconnect cleanup failed:", error.message);
      });
  }

  void emitOnlineUsers();
};

export const disconnectAllNonAdminSockets = (
  message = "Hệ thống đang bảo trì",
  { broadcast = true } = {},
) => {
  const io = getIo();

  if (broadcast && typeof io.serverSideEmit === "function") {
    void io.serverSideEmit("presence:disconnect-non-admin", message);
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

  activeConversationBySocket.clear();
  void emitOnlineUsers();
};

export const getOnlineUsersCount = async () =>
  (await getOnlineVisibleUserIds()).length;
