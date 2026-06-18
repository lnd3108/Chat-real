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
  buildAdminDashboardCacheIndexKey,
  buildAdminDashboardCacheKey,
} from "../../../../shared/infrastructure/cache/cache-keys.js";

const DEFAULT_TTL_SECONDS = 30;
const INDEX_TTL_PADDING_SECONDS = 60;

const isAdminDashboardCacheEnabled = () =>
  isCacheEnabled() &&
  process.env.ADMIN_DASHBOARD_CACHE_ENABLED === "true";

const isDebugEnabled = () =>
  process.env.ADMIN_DASHBOARD_CACHE_DEBUG === "true";

const getTtlSeconds = () => {
  const ttl = Number(process.env.ADMIN_DASHBOARD_CACHE_TTL_SECONDS);
  return Number.isInteger(ttl) && ttl > 0 ? ttl : DEFAULT_TTL_SECONDS;
};

const debugLog = (event, data = {}) => {
  if (!isDebugEnabled()) {
    return;
  }

  console.log("[AdminDashboardCache]", {
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

const hashValue = (value = {}) =>
  crypto
    .createHash("sha256")
    .update(stableStringify(value ?? {}))
    .digest("hex")
    .slice(0, 16);

const getClientOrNull = () => {
  if (!isAdminDashboardCacheEnabled() || !isRedisReady()) {
    return null;
  }

  return getRedisClient();
};

const buildContext = ({ type, query = {}, adminContext = {} }) => {
  const queryHash = hashValue(query);
  const contextHash = hashValue(adminContext);

  return {
    type,
    queryHash,
    contextHash,
    key: buildAdminDashboardCacheKey({
      type,
      contextHash,
      queryHash,
    }),
    indexKey: buildAdminDashboardCacheIndexKey(),
  };
};

export const getCachedAdminDashboardData = async ({
  type,
  query = {},
  adminContext = {},
}) => {
  if (!type || !isAdminDashboardCacheEnabled()) {
    return { hit: false, value: null };
  }

  const context = buildContext({ type, query, adminContext });
  const cached = await getJson(context.key);

  if (cached !== null) {
    debugLog("hit", {
      type,
      contextHash: context.contextHash,
      queryHash: context.queryHash,
    });
    return { hit: true, value: cached };
  }

  debugLog("miss", {
    type,
    contextHash: context.contextHash,
    queryHash: context.queryHash,
  });
  return { hit: false, value: null };
};

export const setCachedAdminDashboardData = async ({
  type,
  query = {},
  adminContext = {},
  value,
}) => {
  if (!type || !isAdminDashboardCacheEnabled()) {
    return false;
  }

  const client = getClientOrNull();
  if (!client) {
    return false;
  }

  const ttl = getTtlSeconds();
  const context = buildContext({ type, query, adminContext });
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
      contextHash: context.contextHash,
      queryHash: context.queryHash,
      ttl,
    });
    return true;
  } catch (error) {
    console.warn("[AdminDashboardCache] index set failed:", error.message);
    return false;
  }
};

export const invalidateAdminDashboardCache = async (
  reason = "unknown",
) => {
  const client = getClientOrNull();
  if (!client) {
    return 0;
  }

  const indexKey = buildAdminDashboardCacheIndexKey();

  try {
    const keys = await client.smembers(indexKey);
    if (keys.length === 0) {
      debugLog("invalidate", { deleted: 0, reason });
      return 0;
    }

    const deleted = await client.del(...keys, indexKey);
    debugLog("invalidate", { deleted, reason });
    return deleted;
  } catch (error) {
    console.warn("[AdminDashboardCache] invalidate failed:", error.message);
    return 0;
  }
};

export const wrapAdminDashboardCache = async ({
  type,
  query = {},
  adminContext = {},
  fetcher,
}) => {
  const cached = await getCachedAdminDashboardData({
    type,
    query,
    adminContext,
  });

  if (cached.hit) {
    return cached.value;
  }

  const value = await fetcher();
  await setCachedAdminDashboardData({
    type,
    query,
    adminContext,
    value,
  });
  return value;
};
