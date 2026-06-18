import {
  getRedisClient,
  isRedisEnabled,
  isRedisReady,
} from "../../../shared/infrastructure/redis/redis-client.js";
import {
  buildRefreshSessionKey,
  hashRefreshToken,
} from "./refresh-session-key.service.js";

export const isRedisRefreshSessionEnabled = () =>
  process.env.AUTH_REDIS_SESSION_ENABLED === "true" && isRedisEnabled();

export const isRedisRefreshSessionReady = () =>
  isRedisRefreshSessionEnabled() && isRedisReady();

const getClientOrNull = () => {
  if (!isRedisRefreshSessionReady()) {
    return null;
  }

  return getRedisClient();
};

const buildKeyFromRefreshToken = (refreshToken) => {
  const tokenHash = hashRefreshToken(refreshToken);
  return buildRefreshSessionKey(tokenHash);
};

const getTtlSeconds = (expiresAt) => {
  const ttlMs = new Date(expiresAt).getTime() - Date.now();
  return Math.max(1, Math.ceil(ttlMs / 1000));
};

export const createRedisRefreshSession = async ({
  refreshToken,
  userId,
  expiresAt,
  source = "redis",
}) => {
  const client = getClientOrNull();
  const key = buildKeyFromRefreshToken(refreshToken);

  if (!client || !key) {
    return { ok: false, reason: "redis_not_ready" };
  }

  const value = {
    userId: String(userId),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    source,
  };

  try {
    await client.set(key, JSON.stringify(value), "EX", getTtlSeconds(expiresAt));
    return { ok: true, key };
  } catch (error) {
    return { ok: false, reason: "redis_write_failed", errorCode: error.code || error.name };
  }
};

export const findRedisRefreshSession = async (refreshToken) => {
  const client = getClientOrNull();
  const key = buildKeyFromRefreshToken(refreshToken);

  if (!client || !key) {
    return { ok: false, hit: false, reason: "redis_not_ready" };
  }

  try {
    const raw = await client.get(key);
    if (!raw) {
      return { ok: true, hit: false, key };
    }

    const session = JSON.parse(raw);
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      await client.del(key);
      return { ok: true, hit: false, key, reason: "expired" };
    }

    return { ok: true, hit: true, key, session };
  } catch (error) {
    return { ok: false, hit: false, key, reason: "redis_read_failed", errorCode: error.code || error.name };
  }
};

export const deleteRedisRefreshSession = async (refreshToken) => {
  const client = getClientOrNull();
  const key = buildKeyFromRefreshToken(refreshToken);

  if (!client || !key) {
    return { ok: false, deleted: 0, reason: "redis_not_ready" };
  }

  try {
    const deleted = await client.del(key);
    return { ok: true, deleted, key };
  } catch (error) {
    return { ok: false, deleted: 0, key, reason: "redis_delete_failed", errorCode: error.code || error.name };
  }
};
