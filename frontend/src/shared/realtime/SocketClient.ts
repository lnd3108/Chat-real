import { io, type Socket } from "socket.io-client";

const baseURL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") ||
  window.location.origin;

export const createSocketClient = (accessToken: string): Socket =>
  io(baseURL, {
    auth: { token: accessToken },
    transports: ["websocket", "polling"],
    autoConnect: true,
  });
