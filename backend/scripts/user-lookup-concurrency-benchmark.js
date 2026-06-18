import dotenv from "dotenv";
import mongoose from "mongoose";
import { performance } from "node:perf_hooks";
import User from "../src/models/User.js";
import { connectDB } from "../src/shared/infrastructure/db/connect-db.js";
import { LOGIN_USER_SELECT } from "../src/modules/auth/infrastructure/auth-user-lookup-cache.service.js";

dotenv.config();

const DEFAULT_CONCURRENCY_LIST = [10, 25, 50];
const DEFAULT_ITERATIONS = 100;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseConcurrencyList = () => {
  const rawValue = process.env.USER_LOOKUP_CONCURRENCY_LIST;
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

const readPoolSize = (name) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : "default";
};

const runLookup = async ({ normalizedUserName, useLean }) => {
  const startedAt = performance.now();
  let query = User.findOne({ userName: normalizedUserName }).select(
    LOGIN_USER_SELECT,
  );

  if (useLean) {
    query = query.lean();
  }

  const user = await query;
  return {
    durationMs: performance.now() - startedAt,
    found: Boolean(user?._id),
  };
};

const runBatch = async ({
  concurrency,
  iterations,
  normalizedUserName,
  useLean,
}) => {
  const durations = [];
  let foundCount = 0;
  let remaining = iterations;

  while (remaining > 0) {
    const batchSize = Math.min(concurrency, remaining);
    const results = await Promise.all(
      Array.from({ length: batchSize }, () =>
        runLookup({ normalizedUserName, useLean }),
      ),
    );

    results.forEach((result) => {
      durations.push(result.durationMs);
      if (result.found) {
        foundCount += 1;
      }
    });
    remaining -= batchSize;
  }

  return {
    concurrency,
    iterations,
    useLean,
    foundCount,
    avgMs: round(
      durations.reduce((total, duration) => total + duration, 0) /
        durations.length,
    ),
    p50Ms: round(percentile(durations, 50)),
    p90Ms: round(percentile(durations, 90)),
    p95Ms: round(percentile(durations, 95)),
    maxMs: round(Math.max(...durations)),
    mongoMaxPoolSize: readPoolSize("MONGO_MAX_POOL_SIZE"),
    mongoMinPoolSize: readPoolSize("MONGO_MIN_POOL_SIZE"),
  };
};

const main = async () => {
  const username = process.env.USER_LOOKUP_USERNAME;
  if (!username) {
    throw new Error("USER_LOOKUP_USERNAME is required");
  }

  const normalizedUserName = username.trim().toLowerCase();
  const concurrencyList = parseConcurrencyList();
  const iterations = parsePositiveInt(
    process.env.USER_LOOKUP_ITERATIONS,
    DEFAULT_ITERATIONS,
  );
  const useLean = process.env.USER_LOOKUP_USE_LEAN === "true";

  await connectDB();

  const results = [];
  for (const concurrency of concurrencyList) {
    results.push(
      await runBatch({
        concurrency,
        iterations,
        normalizedUserName,
        useLean,
      }),
    );
  }

  console.log(
    JSON.stringify(
      {
        useLean,
        iterations,
        concurrencyList,
        mongoMaxPoolSize: readPoolSize("MONGO_MAX_POOL_SIZE"),
        mongoMinPoolSize: readPoolSize("MONGO_MIN_POOL_SIZE"),
        results,
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error) => {
    console.error("[UserLookupBenchmark] Failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
