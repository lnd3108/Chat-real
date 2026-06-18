import helmet from "helmet";

const isProduction = () => process.env.NODE_ENV === "production";

export const securityHeaders = () => [
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: isProduction()
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
        }
      : false,
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
  (_req, res, next) => {
    res.setHeader(
      "Permissions-Policy",
      "camera=(self), microphone=(self), geolocation=()",
    );
    next();
  },
];
