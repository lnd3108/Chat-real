import {
  getRedisClient,
  isRedisEnabled,
  isRedisReady,
} from "../redis/redis-client.js";
import { buildKey } from "./cache-keys.js";
const DEFAULT_TTL_SECONDS = 60;

export const isCacheEnabled = () =>
  isRedisEnabled() && process.env.CACHE_ENABLED === "true";

const shouldDebugCache = () =>
  process.env.DEBUG_CACHE === "true" ||
  String(process.env.DEBUG || "")
    .split(",")
    .map((entry) => entry.trim())
    .includes("cache");

export { buildKey };

const applyTtlJitter = (ttlSeconds = DEFAULT_TTL_SECONDS) => {
  const ttl = Number(ttlSeconds);
  if (!Number.isFinite(ttl) || ttl <= 0) {
    return DEFAULT_TTL_SECONDS;
  }

  const jitterRatio = 1.1 + Math.random() * 0.1;
  return Math.max(1, Math.round(ttl * jitterRatio));
};

const toCacheValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(toCacheValue);
  }

  if (value && typeof value.toObject === "function") {
    return value.toObject({
      getters: false,
      virtuals: false,
      versionKey: false,
      transform: false,
    });
  }

  return value;
};

const getClientOrNull = () => {
  if (!isCacheEnabled() || !isRedisReady()) {
    return null;
  }

  return getRedisClient();
};

export const getJson = async (key) => {
  const client = getClientOrNull();
  if (!client) {
    return null;
  }

  try {
    const raw = await client.get(key);
    if (raw === null) {
      if (shouldDebugCache()) {
        console.debug(`[Cache] MISS ${key}`);
      }
      return null;
    }

    if (shouldDebugCache()) {
      console.debug(`[Cache] HIT ${key}`);
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[Cache] getJson failed for ${key}:`, error.message);
    return null;
  }
};

export const setJson = async (key, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  const client = getClientOrNull();
  if (!client) {
    return false;
  }

  try {
    const payload = JSON.stringify(toCacheValue(value));
    await client.set(key, payload, "EX", applyTtlJitter(ttlSeconds));
    return true;
  } catch (error) {
    console.warn(`[Cache] setJson failed for ${key}:`, error.message);
    return false;
  }
};

export const del = async (...keys) => {
  const client = getClientOrNull();
  const normalizedKeys = keys.flat().filter(Boolean);
  if (!client || normalizedKeys.length === 0) {
    return 0;
  }

  try {
    return await client.del(...normalizedKeys);
  } catch (error) {
    console.warn("[Cache] del failed:", error.message);
    return 0;
  }
};

export const scanDelete = async (pattern, batchSize = 100) => {
  const client = getClientOrNull();
  if (!client) {
    return 0;
  }

  let cursor = "0";
  let deleted = 0;

  try {
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        batchSize,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        deleted += await client.del(...keys);
      }
    } while (cursor !== "0");

    return deleted;
  } catch (error) {
    console.warn(`[Cache] scanDelete failed for ${pattern}:`, error.message);
    return deleted;
  }
};

export const delPattern = scanDelete;

export const wrapCache = async (key, ttlSeconds, fetcher) => {
  const cached = await getJson(key);
  if (cached !== null) {
    return cached;
  }

  const value = await fetcher();
  await setJson(key, value, ttlSeconds);
  return value;
};
