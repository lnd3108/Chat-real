import { Worker } from "bullmq";
import { sendMailDirect } from "../../../utils/mail.js";
import {
  closeRedisConnectionQuietly,
  createBullMqConnection,
  getQueuePrefix,
  isBullMqEnabled,
  isEmailQueueDebugEnabled,
} from "./bullmq-connection.js";
import { EMAIL_JOB_NAMES, QUEUE_NAMES } from "./queue-names.js";

let emailWorkerConnection = null;

export const createEmailWorker = () => {
  if (
    !isBullMqEnabled() ||
    process.env.EMAIL_QUEUE_ENABLED !== "true" ||
    process.env.QUEUE_WORKER_ENABLED !== "true"
  ) {
    console.log("[EmailWorker] Disabled");
    return null;
  }

  emailWorkerConnection = createBullMqConnection("email-worker");
  if (!emailWorkerConnection) {
    console.warn("[EmailWorker] Redis connection unavailable");
    return null;
  }

  const worker = new Worker(
    QUEUE_NAMES.EMAIL,
    async (job) => {
      if (job.name !== EMAIL_JOB_NAMES.SEND_EMAIL) {
        throw new Error(`Unsupported email job: ${job.name}`);
      }

      await sendMailDirect(job.data);
    },
    {
      connection: emailWorkerConnection,
      prefix: getQueuePrefix(),
    },
  );

  worker.on("ready", () => {
    console.log("[EmailWorker] Ready");
  });

  worker.on("completed", (job) => {
    if (isEmailQueueDebugEnabled()) {
      console.log("[EmailWorker] Completed", {
        jobId: job.id,
        templateName: job.data?.templateName || "unknown",
      });
    }
  });

  worker.on("failed", (job, error) => {
    console.warn("[EmailWorker] Failed", {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      templateName: job?.data?.templateName || "unknown",
      error: error.message,
    });
  });

  worker.on("error", (error) => {
    console.warn("[EmailWorker] Error:", error.message);
  });

  console.log("[EmailWorker] Started");
  return worker;
};

export const closeEmailWorker = async (worker) => {
  if (worker) {
    await worker.close();
  }

  await closeRedisConnectionQuietly(emailWorkerConnection);
  emailWorkerConnection = null;
};
