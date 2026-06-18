import { Queue } from "bullmq";
import {
  closeRedisConnectionQuietly,
  createBullMqConnection,
  getCleanupQueueAttempts,
  getCleanupQueueBackoffMs,
  getCleanupQueueRepeatEveryMs,
  getQueuePrefix,
  getQueueRemoveOnComplete,
  getQueueRemoveOnFail,
  isCleanupQueueDebugEnabled,
  isCleanupQueueEnabled,
  isOldQueueJobsCleanupEnabled,
  isStalePresenceCleanupEnabled,
} from "./bullmq-connection.js";
import { CLEANUP_JOB_NAMES, QUEUE_NAMES } from "./queue-names.js";

let cleanupQueue = null;
let cleanupQueueConnection = null;

export const getCleanupQueue = () => {
  if (!isCleanupQueueEnabled()) {
    return null;
  }

  if (cleanupQueue) {
    return cleanupQueue;
  }

  cleanupQueueConnection = createBullMqConnection("cleanup-queue");
  if (!cleanupQueueConnection) {
    return null;
  }

  cleanupQueue = new Queue(QUEUE_NAMES.CLEANUP, {
    connection: cleanupQueueConnection,
    prefix: getQueuePrefix(),
    defaultJobOptions: {
      attempts: getCleanupQueueAttempts(),
      backoff: {
        type: "exponential",
        delay: getCleanupQueueBackoffMs(),
      },
      removeOnComplete: getQueueRemoveOnComplete(),
      removeOnFail: getQueueRemoveOnFail(),
    },
  });

  console.log("[CleanupQueue] Queue initialized");
  return cleanupQueue;
};

export const scheduleCleanupJobs = async () => {
  const queue = getCleanupQueue();
  if (!queue) {
    return { scheduled: false, jobs: [] };
  }

  await queue.waitUntilReady();

  const every = getCleanupQueueRepeatEveryMs();
  const scheduledJobs = [];

  if (isStalePresenceCleanupEnabled()) {
    await queue.add(
      CLEANUP_JOB_NAMES.STALE_PRESENCE,
      {},
      {
        jobId: "cleanup-stale-presence-repeat",
        repeat: { every },
      },
    );
    scheduledJobs.push(CLEANUP_JOB_NAMES.STALE_PRESENCE);
  }

  if (isOldQueueJobsCleanupEnabled()) {
    await queue.add(
      CLEANUP_JOB_NAMES.OLD_QUEUE_JOBS,
      {},
      {
        jobId: "cleanup-old-queue-jobs-repeat",
        repeat: { every },
      },
    );
    scheduledJobs.push(CLEANUP_JOB_NAMES.OLD_QUEUE_JOBS);
  }

  console.log("[CleanupQueue] repeatable jobs scheduled", {
    jobs: scheduledJobs,
    everyMs: every,
  });

  return { scheduled: true, jobs: scheduledJobs, everyMs: every };
};

export const closeCleanupQueue = async () => {
  if (cleanupQueue) {
    await cleanupQueue.close();
    cleanupQueue = null;
  }

  await closeRedisConnectionQuietly(cleanupQueueConnection);
  cleanupQueueConnection = null;
};

export const debugCleanupQueue = (message, data = {}) => {
  if (isCleanupQueueDebugEnabled()) {
    console.log(`[CleanupQueue] ${message}`, data);
  }
};
