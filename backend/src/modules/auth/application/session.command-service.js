import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../../../models/User.js";
import Session from "../../../models/Session.js";
import { ADMIN_SOCKET_EVENTS } from "../../../constants/socketEvents.js";
import {
  buildAuthResponse,
  buildAccessToken,
  createSession,
} from "../infrastructure/token.service.js";
import {
  clearAuthCookies,
  setAccessTokenCookie,
} from "../../../config/auth-cookies.js";
import {
  deleteRedisRefreshSession,
  findRedisRefreshSession,
  isRedisRefreshSessionEnabled,
} from "../infrastructure/refresh-session-redis.service.js";
import { emitAuthLifecycle } from "../infrastructure/auth-realtime.service.js";
import { ensureMaintenanceAccess } from "../infrastructure/maintenance-access.service.js";
import {
  buildBannedResponse,
  isUserBanned,
} from "../domain/auth-access.policy.js";
import {
  buildPendingVerificationResponse,
  sendEmailVerificationForUser,
} from "./verification.service.js";
import {
  elapsedMs,
  logAuthTiming,
  nowMs,
} from "../infrastructure/auth-timing.js";
import {
  getCachedAuthUserByUserName,
  isAuthUserLookupCacheEnabled,
  LOGIN_USER_SELECT,
  setCachedAuthUser,
} from "../infrastructure/auth-user-lookup-cache.service.js";

// Hàm tiện ích để lấy địa chỉ IP từ request
export const signInUser = async ({
  userName,
  password,
  res,
  pipelineTiming = null,
}) => {
  const totalStartedAt = nowMs();
  const timings = {};
  let timingUserId;
  const recordPipelineTiming = () => {
    if (!pipelineTiming) {
      return;
    }

    Object.assign(pipelineTiming, {
      serviceTotalMs: timings.totalSigninMs,
      userLookupMs: timings.userLookupQueryMs,
      userLookupBuildMs: timings.userLookupBuildMs,
      userLookupAwaitMs: timings.userLookupAwaitMs,
      userLookupPostMs: timings.userLookupPostMs,
      bcryptMs: timings.bcryptMs,
      authUserCacheEnabled: timings.authUserCacheEnabled,
      authUserCacheHit: timings.authUserCacheHit,
      authUserCacheReadMs: timings.authUserCacheReadMs,
      authUserCacheWriteMs: timings.authUserCacheWriteMs,
      authUserCacheFallbackReason: timings.authUserCacheFallbackReason,
      maintenanceCheckMs: timings.maintenanceCheckMs,
      maintenanceL1Enabled: timings.maintenanceL1Enabled,
      maintenanceL1Hit: timings.maintenanceL1Hit,
      maintenanceSource: timings.maintenanceSource,
      maintenanceSingleFlightShared: timings.maintenanceSingleFlightShared,
      maintenanceReadMs: timings.maintenanceReadMs,
      maintenanceDecisionMs: timings.maintenanceDecisionMs,
      createSessionMs: timings.createSessionTotalMs,
    });
  };
  const finishTiming = (phase, data = {}) => {
    timings.totalSigninMs = elapsedMs(totalStartedAt);
    recordPipelineTiming();
    logAuthTiming(phase, {
      userId: timingUserId,
      ...timings,
      ...data,
    });
  };
  // Kiểm tra xem có đang trong thời gian bảo trì hay không
  const userLookupStartedAt = nowMs();
  const userLookupBuildStartedAt = nowMs();
  const normalizedUserName = userName.toLowerCase();
  const userLookupFilter = { userName: normalizedUserName };
  timings.authUserCacheEnabled = isAuthUserLookupCacheEnabled();
  timings.userLookupBuildMs = elapsedMs(userLookupBuildStartedAt);
  timings.userPayloadBuildMs = timings.userLookupBuildMs;

  const userLookupAwaitStartedAt = nowMs();
  let user = null;
  if (timings.authUserCacheEnabled) {
    const cacheReadStartedAt = nowMs();
    const cachedUser = await getCachedAuthUserByUserName(normalizedUserName);
    timings.authUserCacheReadMs = elapsedMs(cacheReadStartedAt);
    timings.authUserCacheHit = cachedUser.hit;
    timings.authUserCacheFallbackReason = cachedUser.reason;
    user = cachedUser.user;
  } else {
    timings.authUserCacheHit = false;
    timings.authUserCacheFallbackReason = "disabled";
  }

  if (!user) {
    const userQuery = User.findOne(userLookupFilter);
    user =
      typeof userQuery?.select === "function"
        ? await userQuery.select(LOGIN_USER_SELECT)
        : await userQuery;
  }
  timings.userLookupAwaitMs = elapsedMs(userLookupAwaitStartedAt);

  const userLookupPostStartedAt = nowMs();
  timingUserId = user?._id ? String(user._id) : undefined;
  timings.userLookupPostMs = elapsedMs(userLookupPostStartedAt);
  timings.userLookupQueryMs = elapsedMs(userLookupStartedAt);
  timings.findUserMs = timings.userLookupQueryMs;
  if (timings.authUserCacheEnabled && !timings.authUserCacheHit && user) {
    const cacheWriteStartedAt = nowMs();
    const cacheWrite = await setCachedAuthUser(normalizedUserName, user);
    timings.authUserCacheWriteMs = elapsedMs(cacheWriteStartedAt);
    if (!cacheWrite.written) {
      timings.authUserCacheFallbackReason = cacheWrite.reason;
    }
  }
  if (!user) {
    finishTiming("signin_missing_user", { ok: false });
    return {
      status: 401,
      body: {
        message: "Tên tài khoản hoặc mật khẩu không chính xác.",
      },
    };
  }

  // Kiểm tra mật khẩu
  const bcryptStartedAt = nowMs();
  const passwordCorrect = await bcrypt.compare(password, user.hashedPassword);
  timings.bcryptMs = elapsedMs(bcryptStartedAt);
  if (!passwordCorrect) {
    finishTiming("signin_wrong_password", { ok: false });
    return {
      status: 401,
      body: {
        message: "Tên tài khoản hoặc mật khẩu không chính xác.",
      },
    };
  }

  // Kiểm tra xem người dùng có bị cấm hay không
  if (isUserBanned(user)) {
    finishTiming("signin_banned", { ok: false });
    return { status: 403, body: buildBannedResponse() };
  }

  // Kiểm tra xem có đang trong thời gian bảo trì hay không
  const maintenanceStartedAt = nowMs();
  const maintenanceTiming = {};
  const maintenanceStatus = await ensureMaintenanceAccess(
    user,
    maintenanceTiming,
  );
  timings.maintenanceCheckMs = elapsedMs(maintenanceStartedAt);
  timings.maintenanceL1Enabled = maintenanceTiming.maintenanceL1Enabled;
  timings.maintenanceL1Hit = maintenanceTiming.maintenanceL1Hit;
  timings.maintenanceSource = maintenanceTiming.maintenanceSource;
  timings.maintenanceSingleFlightShared =
    maintenanceTiming.maintenanceSingleFlightShared;
  timings.maintenanceReadMs = maintenanceTiming.maintenanceReadMs;
  timings.maintenanceDecisionMs = maintenanceTiming.maintenanceDecisionMs;
  if (!maintenanceStatus.allowed) {
    finishTiming("signin_maintenance_denied", { ok: false });
    return maintenanceStatus;
  }

  // Kiểm tra xem email đã được xác minh chưa đối với tài khoản local
  if (user.authProvider === "local" && !user.emailVerified) {
    const verification = await sendEmailVerificationForUser(user, "signup", {
      ignoreCooldown: false,
    });

    // Nếu gửi lại mã xác minh thành công
    if (verification.ok) {
      finishTiming("signin_email_unverified", { ok: false });
      return {
        status: 200,
        body: {
          ...verification.payload,
          message:
            "Email của bạn chưa được xác minh. Chúng tôi đã gửi lại mã xác minh.",
        },
      };
    }

    // Nếu đang trong thời gian cooldown gửi lại mã xác minh
    if (verification.status === 429) {
      finishTiming("signin_email_unverified_cooldown", { ok: false });
      return {
        status: 200,
        body: {
          ...buildPendingVerificationResponse(
            user,
            "signup",
            "Email của bạn chưa được xác minh. Vui lòng tiếp tục xác minh trước khi đăng nhập.",
          ),
          resendAvailableAt: verification.resendAvailableAt,
        },
      };
    }

    finishTiming("signin_email_unverified_error", {
      ok: false,
      errorCode: verification.status,
    });
    return {
      status: verification.status,
      body: {
        message: verification.message,
        resendAvailableAt: verification.resendAvailableAt,
      },
    };
  }

  // Tạo phiên đăng nhập và trả về token
  const createSessionStartedAt = nowMs();
  const accessToken = await createSession(user._id, res);
  timings.createSessionTotalMs = elapsedMs(createSessionStartedAt);
  emitAuthLifecycle(ADMIN_SOCKET_EVENTS.USER_LOGIN, user);
  finishTiming("signin_success", { ok: true });
  return {
    status: 200,
    body: buildAuthResponse(user, accessToken),
  };
};

// Hàm tiện ích để lấy payload từ ID token của Google
export const signOutUser = async ({ cookies, authorizationHeader, res }) => {
  const token = cookies?.refreshToken;
  let signedOutUser = null;

  if (authorizationHeader?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(
        authorizationHeader.slice("Bearer ".length),
        process.env.ACCESS_TOKEN_SECRET,
      );
      signedOutUser = await User.findById(decoded.userId).select(
        "displayName userName email avatarUrl role status createdAt",
      );
    } catch {
      signedOutUser = null;
    }
  }

  if (token) {
    await deleteRedisRefreshSession(token);
    await Session.deleteOne({ refreshToken: token });
  }

  clearAuthCookies(res);
  emitAuthLifecycle(ADMIN_SOCKET_EVENTS.USER_LOGOUT, signedOutUser);

  return { sendStatus: 204 };
};

// Hàm trao đổi mã code lấy token từ Google
export const refreshAccessToken = async ({ refreshToken, res }) => {
  if (!refreshToken) {
    return {
      status: 401,
      body: { message: "Token không tồn tại." },
    };
  }

  // Tìm phiên đăng nhập dựa trên refresh token
  let session = null;
  let sessionStoreMode = "mongo";

  if (isRedisRefreshSessionEnabled()) {
    const redisSession = await findRedisRefreshSession(refreshToken);
    if (redisSession.hit) {
      session = redisSession.session;
      sessionStoreMode = "redis";
    } else {
      sessionStoreMode = "mongo_fallback";
    }
  }

  if (!session) {
    session = await Session.findOne({ refreshToken });
  }
  if (!session) {
    return {
      status: 403,
      body: { message: "Token không hợp lệ hoặc đã hết hạn" },
    };
  }

  // Kiểm tra xem token đã hết hạn chưa
  if (new Date(session.expiresAt) < new Date()) {
    if (sessionStoreMode === "redis") {
      await deleteRedisRefreshSession(refreshToken);
    }
    return { status: 403, body: { message: "Token đã hết hạn" } };
  }

  // Tìm người dùng liên kết với phiên đăng nhập
  const user = await User.findById(session.userId).select("status role");
  if (!user) {
    if (sessionStoreMode === "redis") {
      await deleteRedisRefreshSession(refreshToken);
    } else {
      await Session.deleteOne({ _id: session._id });
    }
    return { status: 404, body: { message: "Người dùng không tồn tại." } };
  }

  // Kiểm tra xem người dùng có bị cấm hay không
  if (isUserBanned(user)) {
    await Session.deleteMany({ userId: user._id });
    await deleteRedisRefreshSession(refreshToken);
    clearAuthCookies(res);
    return { status: 403, body: buildBannedResponse() };
  }

  // Kiểm tra xem có đang trong thời gian bảo trì hay không
  const maintenanceStatus = await ensureMaintenanceAccess(user);
  if (!maintenanceStatus.allowed) {
    return maintenanceStatus;
  }

  // Tạo access token mới và gửi về client
  const accessToken = buildAccessToken(session.userId);
  setAccessTokenCookie(res, accessToken);

  return {
    status: 200,
    body: { accessToken },
  };
};
