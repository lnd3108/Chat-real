import { maskSensitiveObject } from "./maskSensitiveData.js";

const isProduction = process.env.NODE_ENV === "production";

const shouldLog = (level) => {
  if (!isProduction) {
    return true;
  }

  return level === "warn" || level === "error";
};

const write = (level, message, meta) => {
  if (!shouldLog(level)) {
    return;
  }

  const payload = meta === undefined ? undefined : maskSensitiveObject(meta);
  const method =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;

  if (payload === undefined) {
    method(message);
    return;
  }

  method(message, payload);
};

export const logger = {
  debug: (message, meta) => write("debug", message, meta),
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta),
};
