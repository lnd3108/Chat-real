import { ADMIN_SOCKET_EVENTS } from "../../../constants/socketEvents.js";
import { buildAuthResponse, createSession } from "../infrastructure/token.service.js";
import { emitAuthLifecycle } from "../infrastructure/auth-realtime.service.js";
import { ensureMaintenanceAccess } from "../infrastructure/maintenance-access.service.js";
import { buildBannedResponse, isUserBanned } from "../domain/auth-access.policy.js";
import {
  getUserById,
  hashVerificationCode,
  sendEmailVerificationForUser,
  verifyPendingToken,
} from "./verification.service.js";

export const verifyEmailWithCode = async ({ verificationToken, code, res }) => {
  if (!verificationToken || !code) {
    return {
      status: 400,
      body: { message: "ThiÃ¡ÂºÂ¿u verificationToken hoÃ¡ÂºÂ·c mÃƒÂ£ xÃƒÂ¡c minh." },
    };
  }

  const tokenStatus = verifyPendingToken(verificationToken);
  if (!tokenStatus.ok) {
    return {
      status: tokenStatus.status,
      body: { message: tokenStatus.message },
    };
  }

  const user = await getUserById(tokenStatus.decoded.userId);
  if (!user) {
    return { status: 404, body: { message: "KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng." } };
  }

  if (isUserBanned(user)) {
    return { status: 403, body: buildBannedResponse() };
  }

  if (
    !user.emailVerificationCodeHash ||
    !user.emailVerificationExpiresAt ||
    user.emailVerificationExpiresAt < new Date()
  ) {
    return { status: 400, body: { message: "MÃƒÂ£ xÃƒÂ¡c minh Ã„â€˜ÃƒÂ£ hÃ¡ÂºÂ¿t hÃ¡ÂºÂ¡n." } };
  }

  const providedCodeHash = hashVerificationCode(String(code).trim());
  if (providedCodeHash !== user.emailVerificationCodeHash) {
    return { status: 400, body: { message: "MÃƒÂ£ xÃƒÂ¡c minh khÃƒÂ´ng Ã„â€˜ÃƒÂºng." } };
  }

  user.emailVerified = true;
  user.emailVerificationCodeHash = undefined;
  user.emailVerificationExpiresAt = undefined;
  user.emailVerificationLastSentAt = undefined;
  await user.save();

  if (tokenStatus.decoded.purpose === "signup") {
    return {
      status: 200,
      body: {
        message:
          "XÃƒÂ¡c minh email thÃƒÂ nh cÃƒÂ´ng. BÃƒÂ¢y giÃ¡Â»Â bÃ¡ÂºÂ¡n cÃƒÂ³ thÃ¡Â»Æ’ Ã„â€˜Ã„Æ’ng nhÃ¡ÂºÂ­p.",
      },
    };
  }

  const maintenanceStatus = await ensureMaintenanceAccess(user);
  if (!maintenanceStatus.allowed) {
    return maintenanceStatus;
  }

  const accessToken = await createSession(user._id, res);
  emitAuthLifecycle(ADMIN_SOCKET_EVENTS.USER_LOGIN, user);

  return {
    status: 200,
    body: buildAuthResponse(user, accessToken),
  };
};

export const resendEmailVerification = async ({ verificationToken }) => {
  if (!verificationToken) {
    return { status: 400, body: { message: "ThiÃ¡ÂºÂ¿u verificationToken." } };
  }

  const tokenStatus = verifyPendingToken(verificationToken);
  if (!tokenStatus.ok) {
    return {
      status: tokenStatus.status,
      body: { message: tokenStatus.message },
    };
  }

  const user = await getUserById(tokenStatus.decoded.userId);
  if (!user) {
    return { status: 404, body: { message: "KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng." } };
  }

  if (user.emailVerified) {
    return { status: 400, body: { message: "Email nÃƒÂ y Ã„â€˜ÃƒÂ£ Ã„â€˜Ã†Â°Ã¡Â»Â£c xÃƒÂ¡c minh." } };
  }

  const verification = await sendEmailVerificationForUser(
    user,
    tokenStatus.decoded.purpose,
    {
      ignoreCooldown: false,
    },
  );

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
    body: {
      ...verification.payload,
      message: "Ã„ÂÃƒÂ£ gÃ¡Â»Â­i lÃ¡ÂºÂ¡i mÃƒÂ£ xÃƒÂ¡c minh tÃ¡Â»â€ºi email cÃ¡Â»Â§a bÃ¡ÂºÂ¡n.",
    },
  };
};
