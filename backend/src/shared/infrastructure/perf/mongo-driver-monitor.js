import cluster from "node:cluster";
import { performance } from "node:perf_hooks";

const DEFAULT_SAMPLE_RATE = 0.02;
const DEFAULT_SLOW_MS = 100;
const DEFAULT_INTERVAL_MS = 5000;

let attachedClient = null;
let poolInterval = null;
const commandStarts = new Map();

const isPoolMonitorEnabled = () =>
  process.env.MONGO_POOL_MONITOR_ENABLED === "true";

export const isMongoCommandMonitorEnabled = () =>
  process.env.MONGO_COMMAND_MONITOR_ENABLED === "true";

const readNumberEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const getSampleRate = () =>
  Math.max(0, Math.min(readNumberEnv("MONGO_MONITOR_SAMPLE_RATE", DEFAULT_SAMPLE_RATE), 1));

const getSlowMs = () => Math.max(0, readNumberEnv("MONGO_MONITOR_SLOW_MS", DEFAULT_SLOW_MS));

const getIntervalMs = () =>
  Math.max(1000, readNumberEnv("MONGO_MONITOR_INTERVAL_MS", DEFAULT_INTERVAL_MS));

const roundMs = (value) =>
  Number.isFinite(value) ? Number(value.toFixed(3)) : null;

const commonFields = () => ({
  pid: process.pid,
  workerId: cluster.isWorker ? cluster.worker?.id : null,
});

const getConnectionId = (event) => {
  if (event?.connectionId == null) {
    return null;
  }

  return String(event.connectionId);
};

const getCollectionName = (event) => {
  if (event?.commandName === "find") {
    return event.command?.find || null;
  }

  return event?.command?.[event.commandName] || null;
};

const shouldTrackCommand = (event) =>
  event?.commandName === "find" && getCollectionName(event) === "users";

const logCommand = ({ event, started, durationMs, eventName, errorName }) => {
  const slow = durationMs >= getSlowMs();
  const sampled = Math.random() < getSampleRate();

  if (!slow && !sampled) {
    return;
  }

  const payload = {
    ...commonFields(),
    event: eventName,
    databaseName: started.databaseName,
    collectionName: started.collectionName,
    commandName: started.commandName,
    durationMs: roundMs(durationMs),
    requestId: event.requestId ?? started.requestId ?? null,
    connectionId: getConnectionId(event) ?? started.connectionId,
    slow,
    sampled,
  };

  if (errorName) {
    payload.errorName = errorName;
  }

  console.log(`[MongoCommandMonitor] ${JSON.stringify(payload)}`);
};

const attachCommandMonitoring = (client) => {
  if (!isMongoCommandMonitorEnabled()) {
    return;
  }

  client.on("commandStarted", (event) => {
    if (!shouldTrackCommand(event)) {
      return;
    }

    commandStarts.set(event.requestId, {
      startedAt: performance.now(),
      databaseName: event.databaseName,
      collectionName: getCollectionName(event),
      commandName: event.commandName,
      requestId: event.requestId,
      connectionId: getConnectionId(event),
    });
  });

  client.on("commandSucceeded", (event) => {
    const started = commandStarts.get(event.requestId);
    if (!started) {
      return;
    }

    commandStarts.delete(event.requestId);
    const durationMs =
      Number.isFinite(event.duration) && event.duration >= 0
        ? event.duration
        : performance.now() - started.startedAt;

    logCommand({
      event,
      started,
      durationMs,
      eventName: "commandSucceeded",
    });
  });

  client.on("commandFailed", (event) => {
    const started = commandStarts.get(event.requestId);
    if (!started) {
      return;
    }

    commandStarts.delete(event.requestId);
    const durationMs =
      Number.isFinite(event.duration) && event.duration >= 0
        ? event.duration
        : performance.now() - started.startedAt;

    logCommand({
      event,
      started,
      durationMs,
      eventName: "commandFailed",
      errorName: event.failure?.name || event.failure?.codeName || "unknown",
    });
  });
};

const createPoolState = () => ({
  checkoutStarted: 0,
  checkedOut: 0,
  checkoutFailed: 0,
  checkedIn: 0,
  poolCreated: 0,
  poolReady: 0,
  poolCleared: 0,
  inUse: 0,
  pendingCheckout: 0,
});

const attachPoolMonitoring = (client) => {
  if (!isPoolMonitorEnabled()) {
    return;
  }

  const state = createPoolState();

  client.on("connectionCheckOutStarted", () => {
    state.checkoutStarted += 1;
    state.pendingCheckout += 1;
  });

  client.on("connectionCheckedOut", () => {
    state.checkedOut += 1;
    state.pendingCheckout = Math.max(0, state.pendingCheckout - 1);
    state.inUse += 1;
  });

  client.on("connectionCheckOutFailed", () => {
    state.checkoutFailed += 1;
    state.pendingCheckout = Math.max(0, state.pendingCheckout - 1);
  });

  client.on("connectionCheckedIn", () => {
    state.checkedIn += 1;
    state.inUse = Math.max(0, state.inUse - 1);
  });

  client.on("connectionPoolCreated", () => {
    state.poolCreated += 1;
  });

  client.on("connectionPoolReady", () => {
    state.poolReady += 1;
  });

  client.on("connectionPoolCleared", () => {
    state.poolCleared += 1;
  });

  poolInterval = setInterval(() => {
    const payload = {
      ...commonFields(),
      event: "poolStats",
      intervalMs: getIntervalMs(),
      checkoutStarted: state.checkoutStarted,
      checkedOut: state.checkedOut,
      checkoutFailed: state.checkoutFailed,
      checkedIn: state.checkedIn,
      poolCreated: state.poolCreated,
      poolReady: state.poolReady,
      poolCleared: state.poolCleared,
      approximateInUse: state.inUse,
      approximatePendingCheckout: state.pendingCheckout,
    };

    console.log(`[MongoPoolMonitor] ${JSON.stringify(payload)}`);
  }, getIntervalMs());

  poolInterval.unref?.();
};

export const attachMongoDriverMonitoring = (client) => {
  if (!client || attachedClient === client) {
    return;
  }

  attachedClient = client;
  attachCommandMonitoring(client);
  attachPoolMonitoring(client);

  if (isPoolMonitorEnabled() || isMongoCommandMonitorEnabled()) {
    console.log("[MongoMonitor] Attached", {
      ...commonFields(),
      poolMonitorEnabled: isPoolMonitorEnabled(),
      commandMonitorEnabled: isMongoCommandMonitorEnabled(),
      sampleRate: getSampleRate(),
      slowMs: getSlowMs(),
    });
  }
};

export const stopMongoDriverMonitoring = () => {
  if (poolInterval) {
    clearInterval(poolInterval);
    poolInterval = null;
  }
};
