import crypto from "crypto";
import jwt from "jsonwebtoken";
import Session from "../../../models/Session.js";
import { sanitizeAuthResponse } from "../../../utils/sanitizeUser.js";
import {
  REFRESH_TOKEN_MAX_AGE_MS,
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "../../../config/auth-cookies.js";
import {
  elapsedMs,
  getErrorCode,
  logAuthTiming,
  nowMs,
} from "./auth-timing.js";
import {
  createRedisRefreshSession,
  isRedisRefreshSessionReady,
} from "./refresh-session-redis.service.js";

export const ACCESS_TOKEN_TTL = "30m";
export const REFRESH_TOKEN_TTL = REFRESH_TOKEN_MAX_AGE_MS;

export const buildAccessToken = (userId) =>
  jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });

export const createSession = async (userId, res) => {
  const totalStartedAt = nowMs();
  const timings = {};
  const userIdForLog = String(userId);
  let sessionStoreMode = "mongo";

  try {
    const jwtStartedAt = nowMs();
    const accessToken = buildAccessToken(userId);
    timings.jwtSignMs = elapsedMs(jwtStartedAt);

    const randomStartedAt = nowMs();
    const refreshToken = crypto.randomBytes(64).toString("hex");
    timings.randomRefreshTokenMs = elapsedMs(randomStartedAt);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL);

    if (isRedisRefreshSessionReady()) {
      const redisSessionStartedAt = nowMs();
      const redisResult = await createRedisRefreshSession({
        refreshToken,
        userId,
        expiresAt,
      });
      timings.redisSessionWriteMs = elapsedMs(redisSessionStartedAt);

      if (redisResult.ok) {
        sessionStoreMode = "redis";
      } else {
        sessionStoreMode = "mongo_fallback";
      }
    } else if (process.env.AUTH_REDIS_SESSION_ENABLED === "true") {
      sessionStoreMode = "mongo_fallback";
    }

    if (sessionStoreMode !== "redis") {
      const sessionCreateStartedAt = nowMs();
      await Session.create({
        userId,
        refreshToken,
        expiresAt,
      });
      timings.mongoSessionCreateMs = elapsedMs(sessionCreateStartedAt);
      timings.sessionCreateMs = timings.mongoSessionCreateMs;
    }

    const setCookieStartedAt = nowMs();
    setRefreshTokenCookie(res, refreshToken);
    setAccessTokenCookie(res, accessToken);
    timings.setCookieMs = elapsedMs(setCookieStartedAt);

    timings.createSessionTotalMs = elapsedMs(totalStartedAt);
    logAuthTiming("create_session", {
      userId: userIdForLog,
      ok: true,
      sessionStoreMode,
      ...timings,
    });

    return accessToken;
  } catch (error) {
    timings.createSessionTotalMs = elapsedMs(totalStartedAt);
    logAuthTiming("create_session", {
      userId: userIdForLog,
      ok: false,
      errorCode: getErrorCode(error),
      sessionStoreMode,
      ...timings,
    });
    throw error;
  }
};

export const buildAuthResponse = (user, accessToken) => ({
  message: `Người dùng ${user.displayName} đã đăng nhập`,
  accessToken,
  user: sanitizeAuthResponse(user),
});
