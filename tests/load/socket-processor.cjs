"use strict";

const { io } = require("socket.io-client");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5001";
const LOGIN_PATH = process.env.LOGIN_PATH || "/api/auth/signin";
const TEST_USER_COUNT = Number.parseInt(process.env.TEST_USER_COUNT || "1000", 10);
const TEST_USER_PREFIX = process.env.TEST_USER_PREFIX || "testuser";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "Test@123456";
const SOCKET_HOLD_MS = Number.parseInt(process.env.SOCKET_HOLD_MS || "30000", 10);
const SOCKET_TIMEOUT_MS = Number.parseInt(
  process.env.SOCKET_TIMEOUT_MS || "5000",
  10,
);
const JOIN_CONVERSATION_ID = process.env.JOIN_CONVERSATION_ID || "";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const assertSafeTarget = () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run Socket.IO load test with NODE_ENV=production.");
  }

  if (process.env.LOAD_TEST !== "true") {
    throw new Error("Refusing to run Socket.IO load test unless LOAD_TEST=true.");
  }

  const isLocal =
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(BASE_URL);
  const isNonProdNamedHost = /(?:staging|stage|test|dev|localhost|127\.0\.0\.1)/i.test(
    BASE_URL,
  );

  if (!isLocal && !isNonProdNamedHost) {
    throw new Error(`Refusing to run against unsafe BASE_URL=${BASE_URL}.`);
  }
};

const pickUserIndex = () => Math.floor(Math.random() * TEST_USER_COUNT) + 1;

const login = async (userIndex) => {
  const response = await fetch(`${BASE_URL}${LOGIN_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Load-Test": "true",
    },
    body: JSON.stringify({
      userName: `${TEST_USER_PREFIX}${userIndex}`,
      password: TEST_PASSWORD,
    }),
  });

  if (!response.ok) {
    throw new Error(`Login failed with status ${response.status}.`);
  }

  const body = await response.json();
  if (!body || typeof body.accessToken !== "string" || !body.accessToken) {
    throw new Error("Login response did not include an access token.");
  }

  return body.accessToken;
};

const connectSocket = (token) =>
  new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token },
      timeout: SOCKET_TIMEOUT_MS,
      reconnection: false,
    });

    const timeoutId = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Socket connection timed out."));
    }, SOCKET_TIMEOUT_MS + 1000);

    socket.once("connect", () => {
      clearTimeout(timeoutId);
      resolve(socket);
    });

    socket.once("connect_error", () => {
      clearTimeout(timeoutId);
      socket.disconnect();
      reject(new Error("Socket connection failed."));
    });
  });

async function runSocketUser(context, events) {
  let socket;
  const startedAt = Date.now();

  try {
    assertSafeTarget();
    const token = await login(pickUserIndex());
    socket = await connectSocket(token);

    events.emit("counter", "socket.connected", 1);

    if (JOIN_CONVERSATION_ID) {
      socket.emit("join-conversation", JOIN_CONVERSATION_ID);
    }

    socket.emit("preferences:showOnlineStatus", true);
    await wait(SOCKET_HOLD_MS);
    socket.emit("preferences:showOnlineStatus", true);

    events.emit("histogram", "socket.session_ms", Date.now() - startedAt);
  } catch (error) {
    events.emit("counter", "socket.errors", 1);
    throw error;
  } finally {
    if (socket) {
      socket.disconnect();
    }
  }
}

module.exports = {
  runSocketUser,
};
