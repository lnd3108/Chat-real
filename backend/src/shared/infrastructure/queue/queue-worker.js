import "dotenv/config";
import {
  closeCleanupWorker,
  createCleanupWorker,
} from "./cleanup.worker.js";
import { closeEmailWorker, createEmailWorker } from "./email.worker.js";

const workerResources = [];

const start = async () => {
  const emailWorker = createEmailWorker();
  if (emailWorker) {
    workerResources.push({
      name: "email",
      worker: emailWorker,
      close: closeEmailWorker,
    });
  }

  const cleanupWorker = await createCleanupWorker();
  if (cleanupWorker) {
    workerResources.push({
      name: "cleanup",
      worker: cleanupWorker,
      close: closeCleanupWorker,
    });
  }

  if (workerResources.length === 0) {
    console.log("[QueueWorker] No workers started");
  }
};

const shutdown = async (signal) => {
  console.log(`[QueueWorker] Shutting down (${signal})`);

  await Promise.all(
    workerResources.map((resource) => resource.close(resource.worker)),
  );
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void start();
