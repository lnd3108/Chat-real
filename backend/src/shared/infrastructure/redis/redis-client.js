import Redis from "ioredis";

const DEFAULT_REDIS_URL = "redis://localhost:6379";

let redisClient = null;
let listenersAttached = false;
let currentStatus = "disabled";

const redactRedisUrl = (value) => {
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    if (parsed.password) {
      parsed.password = "***";
    }
    if (parsed.username) {
      parsed.username = "***";
    }
    return parsed.toString();
  } catch {
    return "[invalid redis url]";
  }
};

export const isRedisEnabled = () => process.env.REDIS_ENABLED === "true";

const getRedisOptions = () => {
  const commonOptions = {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 100, 2000),
  };

  if (process.env.REDIS_URL) {
    return {
      url: process.env.REDIS_URL,
      options: commonOptions,
    };
  }

  const options = {
    ...commonOptions,
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
    db: Number(process.env.REDIS_DB || 0),
  };

  if (process.env.REDIS_PASSWORD) {
    options.password = process.env.REDIS_PASSWORD;
  }

  if (process.env.REDIS_TLS === "true") {
    options.tls = {};
  }

  return { options };
};

const attachListeners = (client) => {
  if (listenersAttached) {
    return;
  }

  client.on("connect", () => {
    currentStatus = "connecting";
    console.log("[Redis] Connecting");
  });

  client.on("ready", () => {
    currentStatus = "ready";
    console.log("[Redis] Ready");
  });

  client.on("close", () => {
    currentStatus = "closed";
    console.warn("[Redis] Connection closed");
  });

  client.on("reconnecting", () => {
    currentStatus = "reconnecting";
    console.warn("[Redis] Reconnecting");
  });

  client.on("end", () => {
    currentStatus = "ended";
    console.warn("[Redis] Connection ended");
  });

  client.on("error", (error) => {
    currentStatus = "error";
    console.warn("[Redis] Error:", error.message);
  });

  listenersAttached = true;
};

export const getRedisClient = () => {
  if (!isRedisEnabled()) {
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  const { url, options } = getRedisOptions();
  redisClient = url ? new Redis(url, options) : new Redis(options);
  currentStatus = "created";
  attachListeners(redisClient);

  if (process.env.NODE_ENV !== "test") {
    const target = url ? redactRedisUrl(url) : `${options.host}:${options.port}/${options.db}`;
    console.log(`[Redis] Client created for ${target || DEFAULT_REDIS_URL}`);
  }

  return redisClient;
};

export const createRedisClient = (overrides = {}) => {
  if (!isRedisEnabled()) {
    return null;
  }

  const { url, options } = getRedisOptions();
  return url
    ? new Redis(url, { ...options, ...overrides })
    : new Redis({ ...options, ...overrides });
};

export const getClient = getRedisClient;

export const isRedisReady = () =>
  isRedisEnabled() && redisClient?.status === "ready";

export const connectRedis = async () => {
  if (!isRedisEnabled()) {
    currentStatus = "disabled";
    return { enabled: false, ok: false, status: "disabled" };
  }

  try {
    const client = getRedisClient();
    if (client.status === "ready") {
      currentStatus = "ready";
      return { enabled: true, ok: true, status: "ready" };
    }

    await client.connect();
    currentStatus = client.status;
    return { enabled: true, ok: client.status === "ready", status: client.status };
  } catch (error) {
    currentStatus = "error";
    console.warn("[Redis] Connect failed, continuing without Redis:", error.message);
    return { enabled: true, ok: false, status: "error", error: error.message };
  }
};

export const ping = async () => {
  const health = await getRedisHealth();
  return health.ok ? "PONG" : null;
};

export const disconnectRedis = async () => {
  if (!redisClient) {
    currentStatus = isRedisEnabled() ? currentStatus : "disabled";
    return;
  }

  try {
    await redisClient.quit();
  } catch (error) {
    console.warn("[Redis] Quit failed, forcing disconnect:", error.message);
    redisClient.disconnect();
  } finally {
    redisClient = null;
    listenersAttached = false;
    currentStatus = "disconnected";
  }
};

export const getRedisHealth = async () => {
  if (!isRedisEnabled()) {
    return {
      enabled: false,
      ok: false,
      status: "disabled",
      latencyMs: null,
    };
  }

  const startedAt = Date.now();

  try {
    const client = getRedisClient();
    if (client.status !== "ready") {
      await connectRedis();
    }

    const pong = await client.ping();
    return {
      enabled: true,
      ok: pong === "PONG",
      status: client.status,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      enabled: true,
      ok: false,
      status: currentStatus,
      latencyMs: Date.now() - startedAt,
      error: error.message,
    };
  }
};

export const getRedisStatus = () => ({
  enabled: isRedisEnabled(),
  status: isRedisEnabled() ? currentStatus : "disabled",
});
