import { createAdapter } from "@socket.io/redis-adapter";
import { createRedisClient, isRedisEnabled } from "../redis/redis-client.js";

let pubClient = null;
let subClient = null;
let setupPromise = null;
let adapterReady = false;

const isSocketRedisAdapterEnabled = () =>
  process.env.SOCKET_REDIS_ADAPTER_ENABLED === "true" && isRedisEnabled();

const attachLifecycleLogs = (client, role) => {
  client.on("connect", () => {
    console.log(`[SocketRedisAdapter] ${role} connecting`);
  });

  client.on("ready", () => {
    console.log(`[SocketRedisAdapter] ${role} ready`);
  });

  client.on("reconnecting", () => {
    console.warn(`[SocketRedisAdapter] ${role} reconnecting`);
  });

  client.on("end", () => {
    console.warn(`[SocketRedisAdapter] ${role} connection ended`);
  });

  client.on("error", (error) => {
    console.warn(`[SocketRedisAdapter] ${role} error:`, error.message);
  });
};

const closeClient = async (client) => {
  if (!client) {
    return;
  }

  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
};

const resetClients = () => {
  pubClient = null;
  subClient = null;
  adapterReady = false;
  setupPromise = null;
};

const setupAdapterOnce = async (io) => {
  if (!isSocketRedisAdapterEnabled()) {
    console.log("[SocketRedisAdapter] Disabled");
    return { enabled: false, ready: false };
  }

  if (pubClient && subClient && adapterReady) {
    return { enabled: true, ready: true, reused: true };
  }

  pubClient = createRedisClient();
  subClient = pubClient?.duplicate();

  if (!pubClient || !subClient) {
    console.warn("[SocketRedisAdapter] Redis is disabled, using local adapter");
    return { enabled: true, ready: false };
  }

  attachLifecycleLogs(pubClient, "pub");
  attachLifecycleLogs(subClient, "sub");

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    adapterReady = true;
    console.log("[SocketRedisAdapter] Ready");
    return { enabled: true, ready: true };
  } catch (error) {
    console.warn(
      "[SocketRedisAdapter] Setup failed, using local adapter:",
      error.message,
    );
    await Promise.all([closeClient(pubClient), closeClient(subClient)]);
    resetClients();
    return { enabled: true, ready: false, error: error.message };
  }
};

export const setupSocketRedisAdapter = async (io) => {
  if (setupPromise) {
    return setupPromise;
  }

  setupPromise = setupAdapterOnce(io).finally(() => {
    if (!adapterReady) {
      setupPromise = null;
    }
  });

  return setupPromise;
};

export const disconnectSocketRedisAdapter = async () => {
  const clients = [pubClient, subClient].filter(Boolean);
  if (clients.length === 0) {
    resetClients();
    return;
  }

  await Promise.allSettled(clients.map(closeClient));
  clients.forEach((client) => client.removeAllListeners());
  resetClients();
  console.log("[SocketRedisAdapter] Closed");
};

export const getSocketRedisAdapterStatus = () => ({
  enabled: isSocketRedisAdapterEnabled(),
  ready: adapterReady,
});
