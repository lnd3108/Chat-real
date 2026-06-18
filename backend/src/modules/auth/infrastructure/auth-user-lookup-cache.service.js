import User from "../../../models/User.js";
import { buildKey, del } from "../../../shared/infrastructure/cache/cache.service.js";
import {
  getRedisClient,
  isRedisReady,
} from "../../../shared/infrastructure/redis/redis-client.js";

export const LOGIN_USER_SELECT = [
  "_id",
  "userName",
  "displayName",
  "email",
  "avatarUrl",
  "authProvider",
  "emailVerified",
  "emailVerificationCodeHash",
  "emailVerificationExpiresAt",
  "emailVerificationLastSentAt",
  "phone",
  "bio",
  "role",
  "roles",
  "permissions",
  "status",
  "hashedPassword",
  "createdAt",
  "updatedAt",
].join(" ");

const DEFAULT_TTL_SECONDS = 60;

export const isAuthUserLookupCacheEnabled = () =>
  process.env.AUTH_USER_LOOKUP_CACHE_ENABLED === "true" &&
  process.env.REDIS_ENABLED === "true" &&
  process.env.CACHE_ENABLED === "true";

const getTtlSeconds = () => {
  const value = Number(process.env.AUTH_USER_LOOKUP_CACHE_TTL_SECONDS);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_TTL_SECONDS;
};

const buildAuthUserLookupKey = (normalizedUserName) =>
  buildKey("auth", "user-lookup", "username", normalizedUserName);

const getClientOrNull = () => {
  if (!isAuthUserLookupCacheEnabled() || !isRedisReady()) {
    return null;
  }

  return getRedisClient();
};

const toPlainUser = (user) =>
  user && typeof user.toObject === "function"
    ? user.toObject({
        getters: false,
        virtuals: false,
        versionKey: false,
        transform: false,
      })
    : user;

const isCacheableAuthUser = (user) =>
  user?.authProvider === "local" &&
  user?.emailVerified === true &&
  user?.status === "active";

export const getCachedAuthUserByUserName = async (normalizedUserName) => {
  if (!isAuthUserLookupCacheEnabled()) {
    return { hit: false, reason: "disabled", user: null };
  }

  try {
    const client = getClientOrNull();
    if (!client) {
      return { hit: false, reason: "redis_unavailable", user: null };
    }

    const raw = await client.get(buildAuthUserLookupKey(normalizedUserName));
    const user = raw ? JSON.parse(raw) : null;
    return user
      ? { hit: true, reason: null, user }
      : { hit: false, reason: "miss", user: null };
  } catch (error) {
    return {
      hit: false,
      reason: "read_error",
      errorCode: error.code || error.name,
      user: null,
    };
  }
};

export const setCachedAuthUser = async (normalizedUserName, user) => {
  if (!isAuthUserLookupCacheEnabled()) {
    return { written: false, reason: "disabled" };
  }

  const plainUser = toPlainUser(user);
  if (!isCacheableAuthUser(plainUser)) {
    return { written: false, reason: "not_cacheable" };
  }

  try {
    const client = getClientOrNull();
    if (!client) {
      return { written: false, reason: "redis_unavailable" };
    }

    await client.set(
      buildAuthUserLookupKey(normalizedUserName),
      JSON.stringify(plainUser),
      "EX",
      getTtlSeconds(),
    );
    return { written: true, reason: null };
  } catch (error) {
    return {
      written: false,
      reason: "write_error",
      errorCode: error.code || error.name,
    };
  }
};

export const invalidateAuthUserLookupCacheByUserName = async (userName) => {
  const normalizedUserName = String(userName || "")
    .trim()
    .toLowerCase();
  if (!normalizedUserName) {
    return 0;
  }

  return del(buildAuthUserLookupKey(normalizedUserName));
};

export const invalidateAuthUserLookupCacheForUser = async (user) =>
  invalidateAuthUserLookupCacheByUserName(user?.userName);

export const invalidateAuthUserLookupCacheForUserId = async (userId) => {
  if (!userId) {
    return 0;
  }

  const user = await User.findById(userId).select("userName").lean();
  return invalidateAuthUserLookupCacheForUser(user);
};
