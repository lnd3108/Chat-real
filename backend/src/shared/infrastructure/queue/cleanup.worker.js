import { Worker } from "bullmq";
import {
  closeRedisConnectionQuietly,
  createBullMqConnection,
  getQueuePrefix,
  isCleanupQueueDebugEnabled,
  isCleanupQueueEnabled,
} from "./bullmq-connection.js";
import { scheduleCleanupJobs } from "./cleanup.queue.js";
import { runCleanupJob } from "./cleanup.jobs.js";
import { QUEUE_NAMES } from "./queue-names.js";

let cleanupWorkerConnection = null;

export const createCleanupWorker = async () => {
  if (
    !isCleanupQueueEnabled() ||
    process.env.QUEUE_WORKER_ENABLED !== "true"
  ) {
    console.log("[CleanupWorker] Disabled");
    return null;
  }

  cleanupWorkerConnection = createBullMqConnection("cleanup-worker");
  if (!cleanupWorkerConnection) {
    console.warn("[CleanupWorker] Redis connection unavailable");
    return null;
  }

  const worker = new Worker(
    QUEUE_NAMES.CLEANUP,
    async (job) => runCleanupJob(job.name),
    {
      connection: cleanupWorkerConnection,
      prefix: getQueuePrefix(),
    },
  );

  worker.on("ready", () => {
    console.log("[CleanupWorker] ready");
  });

  worker.on("completed", (job) => {
    if (isCleanupQueueDebugEnabled()) {
      console.log("[CleanupWorker] completed", {
        jobId: job.id,
        name: job.name,
      });
    }
  });

  worker.on("failed", (job, error) => {
    console.warn("[CleanupWorker] failed", {
      jobId: job?.id,
      name: job?.name,
      attemptsMade: job?.attemptsMade,
      error: error.message,
    });
  });

  worker.on("error", (error) => {
    console.warn("[CleanupWorker] error:", error.message);
  });

  try {
    await scheduleCleanupJobs();
  } catch (error) {
    console.warn("[CleanupWorker] schedule failed:", error.message);
  }

  console.log("[CleanupWorker] Started");
  return worker;
};

export const closeCleanupWorker = async (worker) => {
  if (worker) {
    await worker.close();
  }

  await closeRedisConnectionQuietly(cleanupWorkerConnection);
  cleanupWorkerConnection = null;
};
