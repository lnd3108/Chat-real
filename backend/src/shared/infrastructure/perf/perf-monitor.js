import cluster from "node:cluster";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";

const DEFAULT_INTERVAL_MS = 5000;
const NS_PER_MS = 1_000_000;
const BYTES_PER_MB = 1024 * 1024;

const isEnabled = () => process.env.PERF_MONITOR_ENABLED === "true";

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const round = (value, digits = 3) =>
  Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

const nsToMs = (value) => round(value / NS_PER_MS);

const getActiveCount = (getterName) => {
  const getter = process[getterName];
  return typeof getter === "function" ? getter.call(process).length : null;
};

export const startPerfMonitor = () => {
  if (!isEnabled()) {
    return () => {};
  }

  const intervalMs = toNumber(
    process.env.PERF_MONITOR_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
  );
  const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
  eventLoopDelay.enable();

  let previousCpuUsage = process.cpuUsage();
  let previousEventLoopUtilization = performance.eventLoopUtilization();

  const workerId = cluster.isWorker ? cluster.worker?.id : null;
  console.log("[PerfMonitor] Started", {
    intervalMs,
    pid: process.pid,
    workerId,
  });

  const timer = setInterval(() => {
    const cpuUsage = process.cpuUsage(previousCpuUsage);
    previousCpuUsage = process.cpuUsage();

    const eventLoopUtilization = performance.eventLoopUtilization(
      previousEventLoopUtilization,
    );
    previousEventLoopUtilization = performance.eventLoopUtilization();

    const memory = process.memoryUsage();
    const payload = {
      pid: process.pid,
      workerId,
      uptimeSec: round(process.uptime()),
      intervalMs,
      eventLoopUtilization: round(eventLoopUtilization.utilization, 4),
      eventLoopDelayMeanMs: nsToMs(eventLoopDelay.mean),
      eventLoopDelayP95Ms: nsToMs(eventLoopDelay.percentile(95)),
      eventLoopDelayMaxMs: nsToMs(eventLoopDelay.max),
      cpuUserMs: round(cpuUsage.user / 1000),
      cpuSystemMs: round(cpuUsage.system / 1000),
      rssMb: round(memory.rss / BYTES_PER_MB, 2),
      heapUsedMb: round(memory.heapUsed / BYTES_PER_MB, 2),
      heapTotalMb: round(memory.heapTotal / BYTES_PER_MB, 2),
      externalMb: round(memory.external / BYTES_PER_MB, 2),
      activeHandles: getActiveCount("_getActiveHandles"),
      activeRequests: getActiveCount("_getActiveRequests"),
    };

    console.log(`[PerfMonitor] ${JSON.stringify(payload)}`);
    eventLoopDelay.reset();
  }, intervalMs);

  timer.unref?.();

  return () => {
    clearInterval(timer);
    eventLoopDelay.disable();
    console.log("[PerfMonitor] Stopped", {
      pid: process.pid,
      workerId,
    });
  };
};
