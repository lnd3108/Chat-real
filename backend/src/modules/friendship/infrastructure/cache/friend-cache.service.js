import crypto from "node:crypto";

import {
  getRedisClient,
  isRedisReady,
} from "../../../../shared/infrastructure/redis/redis-client.js";
import {
  getJson,
  isCacheEnabled,
  setJson,
} from "../../../../shared/infrastructure/cache/cache.service.js";
import {
  buildFriendCacheIndexKey,
  buildFriendCacheKey,
} from "../../../../shared/infrastructure/cache/cache-keys.js";

const DEFAULT_TTL_SECONDS = 30;
const INDEX_TTL_PADDING_SECONDS = 60;

const CACHE_TYPES = new Set(["list", "requests", "suggestions"]);

const toIdString = (value) => value?.toString?.() ?? String(value ?? "");

const isFriendCacheEnabled = () =>
  isCacheEnabled() && process.env.FRIEND_CACHE_ENABLED === "true";

const isDebugEnabled = () => process.env.FRIEND_CACHE_DEBUG === "true";

const getTtlSeconds = () => {
  const ttl = Number(process.env.FRIEND_CACHE_TTL_SECONDS);
  return Number.isInteger(ttl) && ttl > 0 ? ttl : DEFAULT_TTL_SECONDS;
};

const debugLog = (event, data = {}) => {
  if (!isDebugEnabled()) {
    return;
  }

  console.log("[FriendCache]", {
    event,
    ...data,
  });
};

const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

const buildQueryHash = (query = {}) =>
  crypto
    .createHash("sha256")
    .update(stableStringify(query ?? {}))
    .digest("hex")
    .slice(0, 16);

const getClientOrNull = () => {
  if (!isFriendCacheEnabled() || !isRedisReady()) {
    return null;
  }

  return getRedisClient();
};

const buildContext = ({ type, userId, query = {} }) => {
  if (!CACHE_TYPES.has(type)) {
    throw new Error(`Unsupported friend cache type: ${type}`);
  }

  const normalizedUserId = toIdString(userId);
  const queryHash = buildQueryHash(query);

  return {
    type,
    userId: normalizedUserId,
    queryHash,
    key: buildFriendCacheKey({
      type,
      userId: normalizedUserId,
      queryHash,
    }),
    indexKey: buildFriendCacheIndexKey(normalizedUserId),
  };
};

export const getCachedFriendData = async ({ type, userId, query = {} }) => {
  if (!userId || !isFriendCacheEnabled()) {
    return { hit: false, value: null };
  }

  const context = buildContext({ type, userId, query });
  const cached = await getJson(context.key);

  if (cached !== null) {
    debugLog("hit", {
      type,
      userId: context.userId,
      queryHash: context.queryHash,
    });
    return { hit: true, value: cached };
  }

  debugLog("miss", {
    type,
    userId: context.userId,
    queryHash: context.queryHash,
  });
  return { hit: false, value: null };
};

export const setCachedFriendData = async ({
  type,
  userId,
  query = {},
  value,
}) => {
  if (!userId || !isFriendCacheEnabled()) {
    return false;
  }

  const client = getClientOrNull();
  if (!client) {
    return false;
  }

  const ttl = getTtlSeconds();
  const context = buildContext({ type, userId, query });
  const stored = await setJson(context.key, value, ttl);

  if (!stored) {
    return false;
  }

  try {
    await client
      .pipeline()
      .sadd(context.indexKey, context.key)
      .expire(context.indexKey, ttl + INDEX_TTL_PADDING_SECONDS)
      .exec();

    debugLog("set", {
      type,
      userId: context.userId,
      queryHash: context.queryHash,
      ttl,
    });
    return true;
  } catch (error) {
    console.warn("[FriendCache] index set failed:", error.message);
    return false;
  }
};

export const invalidateFriendCacheForUser = async (
  userId,
  reason = "unknown",
) => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId) {
    return 0;
  }

  const client = getClientOrNull();
  if (!client) {
    return 0;
  }

  const indexKey = buildFriendCacheIndexKey(normalizedUserId);

  try {
    const keys = await client.smembers(indexKey);
    if (keys.length === 0) {
      debugLog("invalidate", {
        userId: normalizedUserId,
        deleted: 0,
        reason,
      });
      return 0;
    }

    const deleted = await client.del(...keys, indexKey);
    debugLog("invalidate", {
      userId: normalizedUserId,
      deleted,
      reason,
    });
    return deleted;
  } catch (error) {
    console.warn("[FriendCache] invalidate failed:", error.message);
    return 0;
  }
};

export const invalidateFriendCacheForUsers = async (
  userIds,
  reason = "unknown",
) => {
  const uniqueUserIds = [
    ...new Set((userIds ?? []).map(toIdString).filter(Boolean)),
  ];

  await Promise.all(
    uniqueUserIds.map((userId) => invalidateFriendCacheForUser(userId, reason)),
  );
};
