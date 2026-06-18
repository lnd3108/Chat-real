import cluster from "node:cluster";
import os from "node:os";
import { startServer } from "./app/server.js";

const parseWorkerCount = () => {
  const requested = Number(process.env.CLUSTER_WORKERS);
  if (Number.isInteger(requested) && requested > 0) {
    return requested;
  }

  return Math.max(1, Math.min(os.availableParallelism?.() || os.cpus().length, 4));
};

const startSingleProcess = async () => {
  await startServer();
};

const startCluster = () => {
  const workerCount = parseWorkerCount();

  if (process.env.CLUSTER_ENABLED !== "true" || workerCount <= 1) {
    return startSingleProcess();
  }

  if (cluster.isPrimary) {
    console.log("[Cluster] Primary started", {
      pid: process.pid,
      workers: workerCount,
    });

    for (let index = 0; index < workerCount; index += 1) {
      cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
      console.warn("[Cluster] Worker exited", {
        workerId: worker.id,
        pid: worker.process.pid,
        code,
        signal,
      });

      if (!worker.exitedAfterDisconnect) {
        const replacement = cluster.fork();
        console.log("[Cluster] Worker restarted", {
          workerId: replacement.id,
          pid: replacement.process.pid,
        });
      }
    });

    return Promise.resolve();
  }

  console.log("[Cluster] Worker starting", {
    workerId: cluster.worker?.id,
    pid: process.pid,
  });
  return startSingleProcess();
};

startCluster().catch((error) => {
  console.error("[Cluster] Start failed:", error);
  process.exit(1);
});
