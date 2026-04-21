import { maskSensitiveObject } from "@/lib/maskSensitiveData";

const isProduction = import.meta.env.PROD;
type LogLevel = "debug" | "info" | "warn" | "error";

const shouldLog = (level: LogLevel) => {
  if (!isProduction) {
    return true;
  }

  return level === "warn" || level === "error";
};

export const getErrorMeta = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;

    return {
      message: typeof message === "string" ? message : "Unknown error",
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown error",
  };
};

const write = (
  level: LogLevel,
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
        : level === "info"
          ? console.info
          : console.debug;

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
