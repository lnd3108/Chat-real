import { getAllowedOrigins } from "./origin-config.js";

const shouldLogBlockedOrigin = () =>
  ["development", "test"].includes(process.env.NODE_ENV);

export const isOriginAllowed = (origin) => {
  if (!origin) {
    return true;
  }

  return getAllowedOrigins().includes(origin);
};

export const buildCorsOptions = () => ({
  credentials: true,
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }

    if (shouldLogBlockedOrigin()) {
      console.warn(`[CORS] Blocked origin: ${origin}`);
    }

    callback(null, false);
  },
});

export const buildSocketCorsOptions = () => ({
  credentials: true,
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }

    if (shouldLogBlockedOrigin()) {
      console.warn(`[Socket.IO CORS] Blocked origin: ${origin}`);
    }

    callback("Not allowed by CORS", false);
  },
});
