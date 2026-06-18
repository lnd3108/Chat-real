const ENV_ORIGIN_KEYS = ["CLIENT_URL", "CLIENT_URLS", "CORS_ALLOWED_ORIGINS"];

const DEFAULT_DEVELOPMENT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const splitOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const normalizeOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    return parsed.origin;
  } catch {
    return null;
  }
};

export const getAllowedOrigins = () => {
  const configuredOrigins = ENV_ORIGIN_KEYS.flatMap((key) =>
    splitOrigins(process.env[key]),
  );
  const origins =
    process.env.NODE_ENV === "production"
      ? configuredOrigins
      : [...configuredOrigins, ...DEFAULT_DEVELOPMENT_ORIGINS];

  return [
    ...new Set(
      origins
        .filter((origin) => origin !== "*")
        .map(normalizeOrigin)
        .filter(Boolean),
    ),
  ];
};

export const isHttpsOrigin = (origin) => {
  try {
    return new URL(origin).protocol === "https:";
  } catch {
    return false;
  }
};

export const validateProductionTransportConfig = () => {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.length === 0) {
    throw new Error(
      "Production requires at least one HTTPS client origin in CLIENT_URL, CLIENT_URLS, or CORS_ALLOWED_ORIGINS.",
    );
  }

  const insecureOrigins = allowedOrigins.filter((origin) => !isHttpsOrigin(origin));
  if (insecureOrigins.length > 0) {
    throw new Error(
      `Production client origins must use HTTPS: ${insecureOrigins.join(", ")}`,
    );
  }

  const frontendApiUrl = process.env.VITE_API_URL;
  if (frontendApiUrl && !isHttpsOrigin(frontendApiUrl)) {
    throw new Error("Production VITE_API_URL must use HTTPS when provided.");
  }

  const frontendSocketUrl = process.env.VITE_SOCKET_URL;
  if (frontendSocketUrl) {
    const protocol = new URL(frontendSocketUrl).protocol;
    if (!["https:", "wss:"].includes(protocol)) {
      throw new Error("Production VITE_SOCKET_URL must use HTTPS or WSS when provided.");
    }
  }
};
