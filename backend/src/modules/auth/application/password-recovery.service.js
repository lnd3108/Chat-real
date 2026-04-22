import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../../../models/User.js";
import Session from "../../../models/Session.js";
import PasswordResetOtp from "../../../models/PasswordResetOtp.js";
import { sendPasswordResetOtpEmail } from "../infrastructure/auth-mail.service.js";
import {
  generatePasswordResetOtp,
  generatePasswordResetToken,
  hashOtpValue,
  isOtpFormatValid,
  PASSWORD_RESET_MAX_ATTEMPTS,
  PASSWORD_RESET_MAX_SENDS_PER_HOUR,
  PASSWORD_RESET_OTP_TTL_MS,
  PASSWORD_RESET_RESEND_COOLDOWN_MS,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from "../../../services/otpService.js";
import { isMailConfigured } from "../infrastructure/auth-mail.service.js";

const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "Náº¿u email há»£p lá»‡ trong há»‡ thá»‘ng, mÃ£ xÃ¡c nháº­n Ä‘Ã£ Ä‘Æ°á»£c gá»­i.";
const GENERIC_VERIFY_OTP_MESSAGE =
  "MÃ£ xÃ¡c nháº­n khÃ´ng há»£p lá»‡, Ä‘Ã£ háº¿t háº¡n hoáº·c Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng.";
const INVALID_RESET_TOKEN_MESSAGE =
  "PhiÃªn Ä‘áº·t láº¡i máº­t kháº©u khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n. Vui lÃ²ng thá»±c hiá»‡n láº¡i tá»« Ä‘áº§u.";
const PASSWORD_RESET_MAX_SENDS_PER_IP_PER_HOUR = 20;

const forgotPasswordSchemaError = (message, extra = {}) => ({
  status: 400,
  message,
  ...extra,
});

const getNormalizedEmail = (email) => String(email || "").trim().toLowerCase();

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validateStrongPassword = (password) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);

const getRequestIp = (req) =>
  req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
  req.ip ||
  null;

const buildResetToken = ({ otpId, userId, email }) =>
  jwt.sign(
    {
      type: "password-reset",
      otpId,
      userId,
      email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: Math.floor(PASSWORD_RESET_TOKEN_TTL_MS / 1000) },
  );

const verifyResetTokenJwt = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    if (decoded.type !== "password-reset") {
      return { ok: false };
    }

    return { ok: true, decoded };
  } catch {
    return { ok: false };
  }
};

const invalidateActiveOtpRequests = async ({ userId, email }) => {
  await PasswordResetOtp.updateMany(
    {
      userId,
      email,
      isUsed: false,
      invalidatedAt: null,
    },
    {
      $set: {
        invalidatedAt: new Date(),
      },
    },
  );
};

const getLatestPasswordResetRequest = async (email) =>
  PasswordResetOtp.findOne({
    email,
    isUsed: false,
  }).sort({ createdAt: -1 });

const consumeInvalidOrExpiredRequest = async (record) => {
  if (!record || record.isUsed || record.invalidatedAt) {
    return;
  }

  if (record.expiresAt <= new Date()) {
    record.invalidatedAt = new Date();
    await record.save();
  }
};

export const requestPasswordReset = async ({ email, req }) => {
  const normalizedEmail = getNormalizedEmail(email);
  const requestIp = getRequestIp(req);

  if (!normalizedEmail) {
    throw forgotPasswordSchemaError("Email khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.");
  }

  if (!validateEmail(normalizedEmail)) {
    throw forgotPasswordSchemaError("Email khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng.");
  }

  if (!isMailConfigured()) {
    throw {
      status: 500,
      message: "Há»‡ thá»‘ng chÆ°a cáº¥u hÃ¬nh gá»­i email Ä‘áº·t láº¡i máº­t kháº©u.",
    };
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || user.authProvider !== "local") {
    return {
      message: GENERIC_FORGOT_PASSWORD_MESSAGE,
      resendAvailableAt: Date.now() + PASSWORD_RESET_RESEND_COOLDOWN_MS,
    };
  }

  const latestRequest = await getLatestPasswordResetRequest(normalizedEmail);
  if (latestRequest) {
    await consumeInvalidOrExpiredRequest(latestRequest);
  }

  const refreshedLatestRequest =
    await getLatestPasswordResetRequest(normalizedEmail);
  const latestSentAt = refreshedLatestRequest?.lastSentAt?.getTime?.();

  if (
    latestSentAt &&
    Date.now() < latestSentAt + PASSWORD_RESET_RESEND_COOLDOWN_MS
  ) {
    throw {
      status: 429,
      message: "Báº¡n chá»‰ cÃ³ thá»ƒ gá»­i láº¡i mÃ£ sau 60 giÃ¢y.",
      resendAvailableAt: latestSentAt + PASSWORD_RESET_RESEND_COOLDOWN_MS,
    };
  }

  const hourlyThreshold = new Date(Date.now() - 60 * 60 * 1000);
  const hourlySendCount = await PasswordResetOtp.countDocuments({
    email: normalizedEmail,
    createdAt: { $gte: hourlyThreshold },
  });

  if (hourlySendCount >= PASSWORD_RESET_MAX_SENDS_PER_HOUR) {
    throw {
      status: 429,
      message: "Báº¡n Ä‘Ã£ gá»­i mÃ£ quÃ¡ nhiá»u láº§n. Vui lÃ²ng thá»­ láº¡i sau.",
      resendAvailableAt: Date.now() + PASSWORD_RESET_RESEND_COOLDOWN_MS,
    };
  }

  if (requestIp) {
    const ipHourlySendCount = await PasswordResetOtp.countDocuments({
      requestIp,
      createdAt: { $gte: hourlyThreshold },
    });

    if (ipHourlySendCount >= PASSWORD_RESET_MAX_SENDS_PER_IP_PER_HOUR) {
      throw {
        status: 429,
        message:
          "Báº¡n Ä‘Ã£ gá»­i mÃ£ quÃ¡ nhiá»u láº§n. Vui lÃ²ng thá»­ láº¡i sau.",
        resendAvailableAt: Date.now() + PASSWORD_RESET_RESEND_COOLDOWN_MS,
      };
    }
  }

  await invalidateActiveOtpRequests({ userId: user._id, email: normalizedEmail });

  const otp = generatePasswordResetOtp();
  const now = new Date();

  const otpRecord = await PasswordResetOtp.create({
    userId: user._id,
    email: normalizedEmail,
    otpHash: hashOtpValue(otp),
    expiresAt: new Date(now.getTime() + PASSWORD_RESET_OTP_TTL_MS),
    attempts: 0,
    maxAttempts: PASSWORD_RESET_MAX_ATTEMPTS,
    lastSentAt: now,
    requestIp,
    userAgent: req.headers["user-agent"] || null,
  });

  try {
    await sendPasswordResetOtpEmail({
      email: normalizedEmail,
      code: otp,
      displayName: user.displayName,
    });
  } catch {
    await PasswordResetOtp.deleteOne({ _id: otpRecord._id });
    throw {
      status: 500,
      message: "KhÃ´ng thá»ƒ gá»­i email xÃ¡c nháº­n lÃºc nÃ y. Vui lÃ²ng thá»­ láº¡i sau.",
    };
  }

  return {
    message: GENERIC_FORGOT_PASSWORD_MESSAGE,
    resendAvailableAt: now.getTime() + PASSWORD_RESET_RESEND_COOLDOWN_MS,
  };
};

export const verifyPasswordResetOtp = async ({ email, otp }) => {
  const normalizedEmail = getNormalizedEmail(email);
  const trimmedOtp = String(otp || "").trim();

  if (!normalizedEmail) {
    throw forgotPasswordSchemaError("Email khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.");
  }

  if (!validateEmail(normalizedEmail)) {
    throw forgotPasswordSchemaError("Email khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng.");
  }

  if (!isOtpFormatValid(trimmedOtp)) {
    throw forgotPasswordSchemaError("MÃ£ xÃ¡c nháº­n pháº£i gá»“m Ä‘Ãºng 6 chá»¯ sá»‘.");
  }

  const request = await getLatestPasswordResetRequest(normalizedEmail);
  if (!request || request.invalidatedAt || request.isUsed) {
    throw {
      status: 400,
      message: GENERIC_VERIFY_OTP_MESSAGE,
    };
  }

  if (request.expiresAt <= new Date()) {
    request.invalidatedAt = new Date();
    await request.save();
    throw {
      status: 400,
      message: "MÃ£ xÃ¡c nháº­n Ä‘Ã£ háº¿t háº¡n. Vui lÃ²ng yÃªu cáº§u gá»­i mÃ£ má»›i.",
    };
  }

  if (request.attempts >= request.maxAttempts) {
    request.invalidatedAt = new Date();
    await request.save();
    throw {
      status: 429,
      message: "MÃ£ xÃ¡c nháº­n Ä‘Ã£ bá»‹ khÃ³a do nháº­p sai quÃ¡ sá»‘ láº§n cho phÃ©p.",
    };
  }

  const providedOtpHash = hashOtpValue(trimmedOtp);
  if (providedOtpHash !== request.otpHash) {
    request.attempts += 1;

    if (request.attempts >= request.maxAttempts) {
      request.invalidatedAt = new Date();
    }

    await request.save();

    throw {
      status: request.attempts >= request.maxAttempts ? 429 : 400,
      message:
        request.attempts >= request.maxAttempts
          ? "MÃ£ xÃ¡c nháº­n Ä‘Ã£ bá»‹ khÃ³a do nháº­p sai quÃ¡ sá»‘ láº§n cho phÃ©p."
          : "MÃ£ xÃ¡c nháº­n khÃ´ng Ä‘Ãºng.",
      attemptsRemaining: Math.max(request.maxAttempts - request.attempts, 0),
    };
  }

  const resetToken = generatePasswordResetToken();
  request.resetTokenHash = hashOtpValue(resetToken);
  request.resetTokenExpiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
  request.verifiedAt = new Date();
  request.attempts = 0;
  await request.save();

  return {
    message: "XÃ¡c nháº­n mÃ£ thÃ nh cÃ´ng. Báº¡n cÃ³ thá»ƒ Ä‘áº·t máº­t kháº©u má»›i.",
    resetToken: buildResetToken({
      otpId: request._id.toString(),
      userId: request.userId.toString(),
      email: request.email,
    }),
    resetTokenValue: resetToken,
    resetTokenExpiresAt: request.resetTokenExpiresAt.getTime(),
  };
};

export const resetPasswordWithVerifiedOtp = async ({
  email,
  resetToken,
  resetTokenValue,
  newPassword,
  confirmPassword,
}) => {
  const normalizedEmail = getNormalizedEmail(email);

  if (!normalizedEmail) {
    throw forgotPasswordSchemaError("Email khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.");
  }

  if (!validateEmail(normalizedEmail)) {
    throw forgotPasswordSchemaError("Email khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng.");
  }

  if (!resetToken || !resetTokenValue) {
    throw forgotPasswordSchemaError(
      "Thiáº¿u thÃ´ng tin xÃ¡c thá»±c phiÃªn Ä‘áº·t láº¡i máº­t kháº©u.",
    );
  }

  if (!newPassword || !confirmPassword) {
    throw forgotPasswordSchemaError(
      "Vui lÃ²ng nháº­p máº­t kháº©u má»›i vÃ  xÃ¡c nháº­n máº­t kháº©u má»›i.",
    );
  }

  if (!validateStrongPassword(newPassword)) {
    throw forgotPasswordSchemaError(
      "Máº­t kháº©u má»›i pháº£i cÃ³ Ã­t nháº¥t 8 kÃ½ tá»±, gá»“m chá»¯ hoa, chá»¯ thÆ°á»ng vÃ  sá»‘.",
    );
  }

  if (newPassword !== confirmPassword) {
    throw forgotPasswordSchemaError("XÃ¡c nháº­n máº­t kháº©u khÃ´ng khá»›p.");
  }

  const tokenStatus = verifyResetTokenJwt(resetToken);
  if (!tokenStatus.ok || tokenStatus.decoded.email !== normalizedEmail) {
    throw {
      status: 401,
      message: INVALID_RESET_TOKEN_MESSAGE,
    };
  }

  const request = await PasswordResetOtp.findById(tokenStatus.decoded.otpId);
  if (
    !request ||
    request.email !== normalizedEmail ||
    request.isUsed ||
    request.invalidatedAt ||
    !request.resetTokenHash ||
    !request.resetTokenExpiresAt ||
    request.resetTokenExpiresAt <= new Date()
  ) {
    throw {
      status: 401,
      message: INVALID_RESET_TOKEN_MESSAGE,
    };
  }

  if (hashOtpValue(resetTokenValue) !== request.resetTokenHash) {
    throw {
      status: 401,
      message: INVALID_RESET_TOKEN_MESSAGE,
    };
  }

  const user = await User.findById(request.userId);
  if (!user || user.email !== normalizedEmail) {
    throw {
      status: 404,
      message: "KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng tÆ°Æ¡ng á»©ng.",
    };
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.hashedPassword);
  if (isSamePassword) {
    throw {
      status: 400,
      message: "Máº­t kháº©u má»›i khÃ´ng Ä‘Æ°á»£c trÃ¹ng vá»›i máº­t kháº©u hiá»‡n táº¡i.",
    };
  }

  user.hashedPassword = await bcrypt.hash(newPassword, 10);
  await user.save();

  request.isUsed = true;
  request.usedAt = new Date();
  request.invalidatedAt = new Date();
  request.resetTokenHash = null;
  request.resetTokenExpiresAt = null;
  await request.save();

  await PasswordResetOtp.updateMany(
    {
      userId: user._id,
      _id: { $ne: request._id },
      isUsed: false,
      invalidatedAt: null,
    },
    {
      $set: {
        invalidatedAt: new Date(),
      },
    },
  );

  await Session.deleteMany({ userId: user._id });

  return {
    message: "Äá»•i máº­t kháº©u thÃ nh cÃ´ng. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.",
  };
};
