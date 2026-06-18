import { performance } from "node:perf_hooks";

export const shouldLogAuthTiming = () =>
  process.env.AUTH_TIMING_DEBUG === "true";

export const nowMs = () => performance.now();

export const elapsedMs = (startedAt) =>
  Number((performance.now() - startedAt).toFixed(3));

export const getErrorCode = (error) =>
  error?.code || error?.name || error?.status || "unknown";

export const logAuthTiming = (phase, data = {}) => {
  if (!shouldLogAuthTiming()) {
    return;
  }

  console.log(
    `[AuthTiming] ${JSON.stringify({
      phase,
      ...data,
    })}`,
  );
};
