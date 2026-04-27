import { ADMIN_SOCKET_EVENTS } from "../../../constants/socketEvents.js";
import {
  buildAuthResponse,
  createSession,
} from "../infrastructure/token.service.js";
import { emitAuthLifecycle } from "../infrastructure/auth-realtime.service.js";
import { ensureMaintenanceAccess } from "../infrastructure/maintenance-access.service.js";
import { buildBannedResponse, isUserBanned } from "../domain/auth-access.policy.js";
import { sendEmailVerificationForUser } from "./verification.service.js";
import {
  ensureGoogleEmailIsAllowed,
  exchangeGoogleCodeForTokens,
  findOrCreateGoogleUser,
  verifyGoogleIdToken,
} from "./google-auth.service.js";

// Hàm tạo URL đăng nhập Google
export const signInWithGoogle = async ({ code, res }) => {
  if (!code) {
    return { status: 400, body: { message: "Thiếu code từ Google." } };
  }

  const tokenResult = await exchangeGoogleCodeForTokens(code);
  const payload = await verifyGoogleIdToken(tokenResult.id_token);

  const googleEmailError = ensureGoogleEmailIsAllowed(payload);
  if (googleEmailError) {
    return { status: 400, body: { message: googleEmailError } };
  }

  const user = await findOrCreateGoogleUser(payload);

  if (isUserBanned(user)) {
    return { status: 403, body: buildBannedResponse() };
  }

  const maintenanceStatus = await ensureMaintenanceAccess(user);
  if (!maintenanceStatus.allowed) {
    return maintenanceStatus;
  }

  if (!user.emailVerified) {
    const verification = await sendEmailVerificationForUser(user, "google-signin", {
      ignoreCooldown: true,
    });

    if (!verification.ok) {
      return {
        status: verification.status,
        body: {
          message: verification.message,
          resendAvailableAt: verification.resendAvailableAt,
        },
      };
    }

    return {
      status: 200,
      body: verification.payload,
    };
  }

  const accessToken = await createSession(user._id, res);
  emitAuthLifecycle(ADMIN_SOCKET_EVENTS.USER_LOGIN, user);
  return {
    status: 200,
    body: buildAuthResponse(user, accessToken),
  };
};