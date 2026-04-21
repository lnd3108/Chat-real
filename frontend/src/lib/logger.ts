import { maskSensitiveObject } from "@/lib/maskSensitiveData";

const isProduction = import.meta.env.PROD;

const shouldLog = (level: "debug" | "info" | "warn" | "error") => {
  if (!isProduction) {
    return true;
  }

  return level === "warn" || level === "error";
};

const write = (
  level: "debug" | "info" | "warn" | "error",
  message: string,
  meta?: unknown,
) => {
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
  debug: (message: string, meta?: unknown) => write("debug", message, meta),
  info: (message: string, meta?: unknown) => write("info", message, meta),
  warn: (message: string, meta?: unknown) => write("warn", message, meta),
  error: (message: string, meta?: unknown) => write("error", message, meta),
};
