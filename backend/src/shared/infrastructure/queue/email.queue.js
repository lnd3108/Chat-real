import { Queue } from "bullmq";
import {
  closeRedisConnectionQuietly,
  createBullMqConnection,
  getEmailQueueAttempts,
  getEmailQueueBackoffMs,
  getQueuePrefix,
  getQueueRemoveOnComplete,
  getQueueRemoveOnFail,
  isBullMqEnabled,
  isEmailQueueDebugEnabled,
} from "./bullmq-connection.js";
import { EMAIL_JOB_NAMES, QUEUE_NAMES } from "./queue-names.js";

let emailQueue = null;
let emailQueueConnection = null;

export const isEmailQueueEnabled = () =>
  isBullMqEnabled() && process.env.EMAIL_QUEUE_ENABLED === "true";

const getEmailQueue = () => {
  if (!isEmailQueueEnabled()) {
    return null;
  }

  if (emailQueue) {
    return emailQueue;
  }

  emailQueueConnection = createBullMqConnection("email-queue");
  if (!emailQueueConnection) {
    return null;
  }

  emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
    connection: emailQueueConnection,
    prefix: getQueuePrefix(),
    defaultJobOptions: {
      attempts: getEmailQueueAttempts(),
      backoff: {
        type: "exponential",
        delay: getEmailQueueBackoffMs(),
      },
      removeOnComplete: getQueueRemoveOnComplete(),
      removeOnFail: getQueueRemoveOnFail(),
    },
  });

  console.log("[EmailQueue] Queue initialized");
  return emailQueue;
};

export const enqueueEmail = async (payload) => {
  const queue = getEmailQueue();
  if (!queue) {
    return { queued: false, reason: "disabled" };
  }

  await queue.waitUntilReady();
  const job = await queue.add(EMAIL_JOB_NAMES.SEND_EMAIL, payload);

  if (isEmailQueueDebugEnabled()) {
    console.log("[EmailQueue] Enqueued", {
      jobId: job.id,
      templateName: payload?.templateName || "unknown",
    });
  }

  return { queued: true, jobId: job.id };
};

export const sendEmailOrEnqueue = async (payload, fallbackSender) => {
  if (!isEmailQueueEnabled()) {
    return fallbackSender(payload);
  }

  try {
    const result = await enqueueEmail(payload);
    if (result.queued) {
      return result;
    }
  } catch (error) {
    console.warn("[EmailQueue] Enqueue failed, falling back to direct SMTP:", {
      templateName: payload?.templateName || "unknown",
      error: error.message,
    });
  }

  return fallbackSender(payload);
};

export const closeEmailQueue = async () => {
  if (emailQueue) {
    await emailQueue.close();
    emailQueue = null;
  }

  await closeRedisConnectionQuietly(emailQueueConnection);
  emailQueueConnection = null;
};
