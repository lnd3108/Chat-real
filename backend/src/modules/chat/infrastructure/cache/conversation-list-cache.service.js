import crypto from "node:crypto";

import Conversation from "../../../../models/Conversation.js";
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
  buildConversationListIndexKey,
  buildConversationListKey,
} from "../../../../shared/infrastructure/cache/cache-keys.js";

const DEFAULT_TTL_SECONDS = 15;
const INDEX_TTL_PADDING_SECONDS = 60;

const toIdString = (value) => value?.toString?.() ?? String(value ?? "");

const isConversationListCacheEnabled = () =>
  isCacheEnabled() && process.env.CONVERSATION_LIST_CACHE_ENABLED === "true";

const isDebugEnabled = () =>
  process.env.CONVERSATION_LIST_CACHE_DEBUG === "true";

const getTtlSeconds = () => {
  const ttl = Number(process.env.CONVERSATION_LIST_CACHE_TTL_SECONDS);
  return Number.isInteger(ttl) && ttl > 0 ? ttl : DEFAULT_TTL_SECONDS;
};

const debugLog = (event, data = {}) => {
  if (!isDebugEnabled()) {
    return;
  }

  console.log("[ConversationListCache]", {
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

const buildCacheContext = ({ userId, query }) => {
  const normalizedUserId = toIdString(userId);
  const queryHash = buildQueryHash(query);

  return {
    userId: normalizedUserId,
    queryHash,
    key: buildConversationListKey({
      userId: normalizedUserId,
      queryHash,
    }),
    indexKey: buildConversationListIndexKey(normalizedUserId),
  };
};

const getClientOrNull = () => {
  if (!isConversationListCacheEnabled() || !isRedisReady()) {
    return null;
  }

  return getRedisClient();
};

export const getCachedConversationList = async ({ userId, query = {} }) => {
  if (!userId || !isConversationListCacheEnabled()) {
    return { hit: false, value: null };
  }

  const context = buildCacheContext({ userId, query });
  const cached = await getJson(context.key);

  if (cached !== null) {
    debugLog("hit", {
      userId: context.userId,
      queryHash: context.queryHash,
    });
    return { hit: true, value: cached };
  }

  debugLog("miss", {
    userId: context.userId,
    queryHash: context.queryHash,
  });
  return { hit: false, value: null };
};

export const setCachedConversationList = async ({
  userId,
  query = {},
  conversations,
}) => {
  if (!userId || !isConversationListCacheEnabled()) {
    return false;
  }

  const client = getClientOrNull();
  if (!client) {
    return false;
  }

  const ttl = getTtlSeconds();
  const context = buildCacheContext({ userId, query });
  const stored = await setJson(context.key, conversations, ttl);

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
      userId: context.userId,
      queryHash: context.queryHash,
      ttl,
    });
    return true;
  } catch (error) {
    console.warn("[ConversationListCache] index set failed:", error.message);
    return false;
  }
};

export const invalidateConversationListForUser = async (
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

  const indexKey = buildConversationListIndexKey(normalizedUserId);

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
    console.warn("[ConversationListCache] invalidate failed:", error.message);
    return 0;
  }
};

export const invalidateConversationListForUsers = async (
  userIds,
  reason = "unknown",
) => {
  const uniqueUserIds = [
    ...new Set((userIds ?? []).map(toIdString).filter(Boolean)),
  ];

  await Promise.all(
    uniqueUserIds.map((userId) =>
      invalidateConversationListForUser(userId, reason),
    ),
  );
};

export const getConversationParticipantIds = (conversation) =>
  (conversation?.participants ?? [])
    .map((participant) => participant.userId?._id ?? participant.userId)
    .map(toIdString)
    .filter(Boolean);

export const invalidateConversationListForConversation = async (
  conversationOrId,
  reason = "conversation-changed",
) => {
  if (!conversationOrId) {
    return;
  }

  const participantIds = Array.isArray(conversationOrId?.participants)
    ? getConversationParticipantIds(conversationOrId)
    : getConversationParticipantIds(
        await Conversation.findById(conversationOrId).select("participants"),
      );

  await invalidateConversationListForUsers(participantIds, reason);
};
