import { ADMIN_SOCKET_EVENTS } from "../../../constants/socketEvents.js";
import {
  buildAuthResponse,
  createSession,
} from "../infrastructure/token.service.js";
import { emitAuthLifecycle } from "../infrastructure/auth-realtime.service.js";
import { ensureMaintenanceAccess } from "../infrastructure/maintenance-access.service.js";
import {
  buildBannedResponse,
  isUserBanned,
} from "../domain/auth-access.policy.js";
import {
  getUserById,
  hashVerificationCode,
  sendEmailVerificationForUser,
  verifyPendingToken,
} from "./verification.service.js";

// Xử lý xác minh email bằng mã
export const verifyEmailWithCode = async ({ verificationToken, code, res }) => {
  if (!verificationToken || !code) {
    return {
      status: 400,
      body: { message: "Thiếu verificationToken hoặc mã xác minh." },
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
    return { status: 404, body: { message: "Không tìm thấy người dùng." } };
  }

  if (isUserBanned(user)) {
    return { status: 403, body: buildBannedResponse() };
  }

  if (
    !user.emailVerificationCodeHash ||
    !user.emailVerificationExpiresAt ||
    user.emailVerificationExpiresAt < new Date()
  ) {
    return { status: 400, body: { message: "Mã xác minh đã hết hạn." } };
  }

  const providedCodeHash = hashVerificationCode(String(code).trim());
  if (providedCodeHash !== user.emailVerificationCodeHash) {
    return { status: 400, body: { message: "Mã xác minh không đúng." } };
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
        message: "Xác minh email thành công. Bây giờ bạn có thể đăng nhập.",
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

// Xử lý gửi lại mã xác minh qua email
export const resendEmailVerification = async ({ verificationToken }) => {
  if (!verificationToken) {
    return { status: 400, body: { message: "Thiếu verificationToken." } };
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
    return { status: 404, body: { message: "Không tìm thấy người dùng." } };
  }

  if (user.emailVerified) {
    return { status: 400, body: { message: "Email này đã được xác minh." } };
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
      message: "Đã gửi lại mã xác minh tới email của bạn.",
    },
  };
};
