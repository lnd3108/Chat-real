import { Queue } from "bullmq";
import { cleanupStalePresence } from "../realtime/user-presence.js";
import {
  closeRedisConnectionQuietly,
  createBullMqConnection,
  getCleanupQueueJobRetentionMs,
  getQueuePrefix,
  isCleanupQueueDebugEnabled,
  isOldQueueJobsCleanupEnabled,
  isStalePresenceCleanupEnabled,
} from "./bullmq-connection.js";
import { CLEANUP_JOB_NAMES, QUEUE_NAMES } from "./queue-names.js";

const CLEAN_STATES = ["completed", "failed"];
const CLEAN_LIMIT = 1000;

const countCleanResult = (result) => {
  if (Array.isArray(result)) {
    return result.length;
  }

  return Number.isFinite(result) ? result : 0;
};

const createQueueHandle = (queueName) => {
  const connection = createBullMqConnection(`cleanup-clean-${queueName}`);
  if (!connection) {
    return null;
  }

  return {
    connection,
    queue: new Queue(queueName, {
      connection,
      prefix: getQueuePrefix(),
    }),
  };
};

const closeQueueHandle = async (handle) => {
  if (!handle) {
    return;
  }

  try {
    await handle.queue.close();
  } finally {
    await closeRedisConnectionQuietly(handle.connection);
  }
};

export const runStalePresenceCleanupJob = async () => {
  if (!isStalePresenceCleanupEnabled()) {
    return { skipped: true, reason: "disabled" };
  }

  const result = await cleanupStalePresence({ dryRun: false });

  if (isCleanupQueueDebugEnabled()) {
    console.log("[CleanupWorker] stale presence", {
      scannedUsers: result.scannedUsers,
      scannedSockets: result.scannedSockets,
      removedUsers: result.removedUsers,
      removedSockets: result.removedSockets,
      removedAggregateUsers: result.removedAggregateUsers,
    });
  }

  return result;
};

export const runOldQueueJobsCleanupJob = async () => {
  if (!isOldQueueJobsCleanupEnabled()) {
    return { skipped: true, reason: "disabled" };
  }

  const graceMs = getCleanupQueueJobRetentionMs();
  const queueNames = [QUEUE_NAMES.EMAIL, QUEUE_NAMES.CLEANUP];
  const summary = {};

  for (const queueName of queueNames) {
    const handle = createQueueHandle(queueName);
    if (!handle) {
      summary[queueName] = { skipped: true, reason: "redis-unavailable" };
      continue;
    }

    summary[queueName] = {};

    try {
      await handle.queue.waitUntilReady();

      for (const state of CLEAN_STATES) {
        const cleaned = await handle.queue.clean(graceMs, CLEAN_LIMIT, state);
        summary[queueName][state] = countCleanResult(cleaned);
      }
    } finally {
      await closeQueueHandle(handle);
    }
  }

  if (isCleanupQueueDebugEnabled()) {
    console.log("[CleanupWorker] old queue jobs", {
      retentionMs: graceMs,
      summary,
    });
  }

  return { retentionMs: graceMs, summary };
};

export const runCleanupJob = async (jobName) => {
  switch (jobName) {
    case CLEANUP_JOB_NAMES.STALE_PRESENCE:
      return runStalePresenceCleanupJob();
    case CLEANUP_JOB_NAMES.OLD_QUEUE_JOBS:
      return runOldQueueJobsCleanupJob();
    default:
      throw new Error(`Unsupported cleanup job: ${jobName}`);
  }
};
