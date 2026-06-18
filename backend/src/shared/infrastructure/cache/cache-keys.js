const DEFAULT_KEY_PREFIX = "chatrt:dev";

const normalizeKeyPart = (part) =>
  String(part ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/:+/g, ":");

export const buildKey = (...parts) => {
  const prefix = process.env.REDIS_KEY_PREFIX || DEFAULT_KEY_PREFIX;
  return [prefix, ...parts.map(normalizeKeyPart)].filter(Boolean).join(":");
};

export const buildConversationListKey = ({ userId, queryHash }) =>
  buildKey("conversation", "list", "user", userId, queryHash);

export const buildConversationListIndexKey = (userId) =>
  buildKey("conversation", "list", "index", "user", userId);

export const buildFriendCacheKey = ({ type, userId, queryHash }) =>
  buildKey("friend", type, "user", userId, queryHash);

export const buildFriendCacheIndexKey = (userId) =>
  buildKey("friend", "index", "user", userId);

export const buildAdminDashboardCacheKey = ({
  type,
  contextHash,
  queryHash,
}) => buildKey("admin", "dashboard", type, contextHash, queryHash);

export const buildAdminDashboardCacheIndexKey = () =>
  buildKey("admin", "dashboard", "index");
