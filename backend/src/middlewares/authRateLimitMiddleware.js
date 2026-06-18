import crypto from "crypto";
import {
  getRedisClient,
  isRedisEnabled,
  isRedisReady,
} from "../shared/infrastructure/redis/redis-client.js";
import { buildKey } from "../shared/infrastructure/cache/cache.service.js";

const RATE_LIMIT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return { current, ttl }
`;

const hashIdentifier = (value) =>
  crypto.createHash("sha256").update(String(value || "unknown")).digest("hex");

const normalizeIdentifier = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getRequestIp = (req) => {
  const forwardedFor = req.headers?.["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
};

const isRateLimitEnabled = () =>
  isRedisEnabled() &&
  process.env.RATE_LIMIT_ENABLED === "true" &&
  process.env.RATE_LIMIT_BYPASS !== "true" &&
  process.env.LOAD_TEST !== "true";

const readPositiveIntEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const resolveRules = (rules, req) =>
  rules
    .map((rule) => {
      const identifier = rule.identifier(req);
      if (!identifier) {
        return null;
      }

      return {
        ...rule,
        key: buildKey(
          "rl",
          "auth",
          rule.action,
          rule.scope,
          hashIdentifier(identifier),
        ),
      };
    })
    .filter(Boolean);

const incrementRule = async (client, rule) => {
  const [count, ttl] = await client.eval(
    RATE_LIMIT_SCRIPT,
    1,
    rule.key,
    String(rule.windowSeconds),
  );

  return {
    count: Number(count),
    ttl: Number(ttl),
  };
};

export const createAuthRateLimit = (rules) => async (req, res, next) => {
  if (!isRateLimitEnabled()) {
    return next();
  }

  if (!isRedisReady()) {
    return next();
  }

  const client = getRedisClient();
  if (!client) {
    return next();
  }

  try {
    const resolvedRules = resolveRules(rules, req);

    for (const rule of resolvedRules) {
      const result = await incrementRule(client, rule);
      if (result.count > rule.limit) {
        const retryAfter = Math.max(result.ttl, 1);
        res.set("Retry-After", String(retryAfter));
        return res.status(429).json({
          message: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
          retryAfter,
        });
      }
    }

    return next();
  } catch (error) {
    console.warn("[RateLimit] Redis unavailable, allowing auth request:", error.message);
    return next();
  }
};

const resolveLimit = (action, scope, fallback) =>
  readPositiveIntEnv(
    `RATE_LIMIT_AUTH_${action.toUpperCase()}_${scope.toUpperCase()}_LIMIT`,
    fallback,
  );

const resolveWindow = (action, scope, fallback) =>
  readPositiveIntEnv(
    `RATE_LIMIT_AUTH_${action.toUpperCase()}_${scope.toUpperCase()}_WINDOW_SECONDS`,
    fallback,
  );

const createRule = (action, scope, limit, windowSeconds, identifier) => ({
  action,
  scope,
  limit: resolveLimit(action, scope, limit),
  windowSeconds: resolveWindow(action, scope, windowSeconds),
  identifier,
});

const ipRule = (action, limit, windowSeconds) =>
  createRule(action, "ip", limit, windowSeconds, getRequestIp);

const userRule = (action, limit, windowSeconds) =>
  createRule(action, "user", limit, windowSeconds, (req) =>
    normalizeIdentifier(req.body?.email || req.body?.userName || req.body?.username),
  );

const emailRule = (action, limit, windowSeconds) =>
  createRule(action, "email", limit, windowSeconds, (req) =>
    normalizeIdentifier(req.body?.email),
  );

const tokenRule = (action, limit, windowSeconds) =>
  createRule(action, "token", limit, windowSeconds, (req) =>
    normalizeIdentifier(req.body?.verificationToken),
  );

export const rateLimitAuthSignin = createAuthRateLimit([
  ipRule("signin", 30, 5 * 60),
  userRule("signin", 10, 10 * 60),
]);

export const rateLimitAuthSignup = createAuthRateLimit([
  ipRule("signup", 20, 15 * 60),
  userRule("signup", 10, 15 * 60),
]);

export const rateLimitAuthForgotPassword = createAuthRateLimit([
  ipRule("forgot", 10, 15 * 60),
  emailRule("forgot", 3, 15 * 60),
]);

export const rateLimitAuthResendVerification = createAuthRateLimit([
  ipRule("resend", 10, 15 * 60),
  tokenRule("resend", 5, 15 * 60),
]);

export const rateLimitAuthVerifyForgotPasswordOtp = createAuthRateLimit([
  ipRule("otp", 10, 10 * 60),
  userRule("otp", 5, 10 * 60),
]);
