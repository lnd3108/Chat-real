import { performance } from "node:perf_hooks";
import bcrypt from "bcrypt";

const DEFAULT_CONCURRENCY_LIST = [10, 25, 50];
const DEFAULT_ROUNDS = 10;
const PASSWORD = "synthetic-password-for-benchmark";

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseConcurrencyList = () => {
  const rawValue = process.env.BCRYPT_CONCURRENCY_LIST;
  if (!rawValue) {
    return DEFAULT_CONCURRENCY_LIST;
  }

  const values = rawValue
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  return values.length > 0 ? values : DEFAULT_CONCURRENCY_LIST;
};

const percentile = (values, percentileValue) => {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
};

const round = (value) => Number(value.toFixed(3));

const runBatch = async ({ hash, concurrency }) => {
  const startedAt = performance.now();
  const durations = await Promise.all(
    Array.from({ length: concurrency }, async () => {
      const compareStartedAt = performance.now();
      await bcrypt.compare(PASSWORD, hash);
      return performance.now() - compareStartedAt;
    }),
  );
  const totalMs = performance.now() - startedAt;

  return {
    concurrency,
    totalMs: round(totalMs),
    avgMs: round(
      durations.reduce((total, duration) => total + duration, 0) /
        durations.length,
    ),
    p50Ms: round(percentile(durations, 50)),
    p95Ms: round(percentile(durations, 95)),
    maxMs: round(Math.max(...durations)),
  };
};

const main = async () => {
  const rounds = parsePositiveInt(process.env.BCRYPT_ROUNDS, DEFAULT_ROUNDS);
  const concurrencyList = parseConcurrencyList();
  const hash = await bcrypt.hash(PASSWORD, rounds);

  const results = [];
  for (const concurrency of concurrencyList) {
    results.push(await runBatch({ hash, concurrency }));
  }

  console.log(
    JSON.stringify(
      {
        rounds,
        uvThreadpoolSize: process.env.UV_THREADPOOL_SIZE || "default",
        concurrencyList,
        results,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error("[BcryptBenchmark] Failed:", error.message);
  process.exit(1);
});
