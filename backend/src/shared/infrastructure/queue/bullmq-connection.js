import { createRedisClient, isRedisEnabled } from "../redis/redis-client.js";

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const isBullMqEnabled = () =>
  process.env.BULLMQ_ENABLED === "true" && isRedisEnabled();

export const getQueuePrefix = () =>
  process.env.QUEUE_PREFIX || process.env.REDIS_KEY_PREFIX || "chatrt";

export const getQueueRemoveOnComplete = () =>
  toPositiveInteger(process.env.QUEUE_REMOVE_ON_COMPLETE, 100);

export const getQueueRemoveOnFail = () =>
  toPositiveInteger(process.env.QUEUE_REMOVE_ON_FAIL, 500);

export const getEmailQueueAttempts = () =>
  toPositiveInteger(process.env.EMAIL_QUEUE_ATTEMPTS, 3);

export const getEmailQueueBackoffMs = () =>
  toPositiveInteger(process.env.EMAIL_QUEUE_BACKOFF_MS, 5000);

export const isEmailQueueDebugEnabled = () =>
  process.env.EMAIL_QUEUE_DEBUG === "true";

export const isCleanupQueueEnabled = () =>
  isBullMqEnabled() && process.env.CLEANUP_QUEUE_ENABLED === "true";

export const isCleanupQueueDebugEnabled = () =>
  process.env.CLEANUP_QUEUE_DEBUG === "true";

export const isStalePresenceCleanupEnabled = () =>
  process.env.CLEANUP_STALE_PRESENCE_ENABLED !== "false";

export const isOldQueueJobsCleanupEnabled = () =>
  process.env.CLEANUP_OLD_QUEUE_JOBS_ENABLED !== "false";

export const getCleanupQueueRepeatEveryMs = () =>
  toPositiveInteger(process.env.CLEANUP_QUEUE_REPEAT_EVERY_MS, 3600000);

export const getCleanupQueueJobRetentionMs = () =>
  toPositiveInteger(process.env.CLEANUP_QUEUE_JOB_RETENTION_HOURS, 24) *
  60 *
  60 *
  1000;

export const getCleanupQueueAttempts = () =>
  toPositiveInteger(process.env.CLEANUP_QUEUE_ATTEMPTS, 2);

export const getCleanupQueueBackoffMs = () =>
  toPositiveInteger(process.env.CLEANUP_QUEUE_BACKOFF_MS, 10000);

export const createBullMqConnection = (label) => {
  if (!isBullMqEnabled()) {
    return null;
  }

  const connection = createRedisClient({
    maxRetriesPerRequest: null,
  });

  if (!connection) {
    return null;
  }

  connection.on("error", (error) => {
    console.warn(`[BullMQ] Redis connection error (${label}):`, error.message);
  });

  return connection;
};

export const closeRedisConnectionQuietly = async (connection) => {
  if (!connection) {
    return;
  }

  try {
    await connection.quit();
  } catch {
    connection.disconnect();
  }
};
