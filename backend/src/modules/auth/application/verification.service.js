import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../../../models/User.js";
import {
  isMailConfigured,
  sendAccountDeletionCodeEmail,
  sendVerificationCodeEmail,
} from "../infrastructure/auth-mail.service.js";

const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_TOKEN_TTL = "10m";
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
const ACCOUNT_DELETION_CODE_TTL_MS = 5 * 60 * 1000;
const ACCOUNT_DELETION_RESEND_COOLDOWN_MS = 60 * 1000;

const generateEmailCode = () => String(Math.floor(100000 + Math.random() * 900000));

const hashEmailCode = (code) =>
  crypto.createHash("sha256").update(code).digest("hex");

export const createPendingVerificationToken = (user, purpose) =>
  jwt.sign(
    {
      userId: user._id,
      email: user.email,
      type: "email-verification",
      purpose,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: EMAIL_TOKEN_TTL },
  );

export const buildPendingVerificationResponse = (user, purpose, message) => ({
  requiresEmailVerification: true,
  verificationToken: createPendingVerificationToken(user, purpose),
  email: user.email,
  purpose,
  resendAvailableAt:
    (user.emailVerificationLastSentAt?.getTime?.() || Date.now()) +
    EMAIL_RESEND_COOLDOWN_MS,
  message,
});

const canResendVerification = (user) => {
  const lastSentAt = user.emailVerificationLastSentAt?.getTime?.();
  if (!lastSentAt) {
    return { ok: true, resendAvailableAt: Date.now() };
  }

  const resendAvailableAt = lastSentAt + EMAIL_RESEND_COOLDOWN_MS;
  if (Date.now() < resendAvailableAt) {
    return { ok: false, resendAvailableAt };
  }

  return { ok: true, resendAvailableAt };
};

const persistVerificationCode = async (user) => {
  const code = generateEmailCode();
  user.emailVerificationCodeHash = hashEmailCode(code);
  user.emailVerificationExpiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);
  user.emailVerificationLastSentAt = new Date();
  await user.save();
  return code;
};

const canResendAccountDeletionCode = (user) => {
  const lastSentAt = user.accountDeletionLastSentAt?.getTime?.();
  if (!lastSentAt) {
    return { ok: true, resendAvailableAt: Date.now() };
  }

  const resendAvailableAt = lastSentAt + ACCOUNT_DELETION_RESEND_COOLDOWN_MS;
  if (Date.now() < resendAvailableAt) {
    return { ok: false, resendAvailableAt };
  }

  return { ok: true, resendAvailableAt };
};

const persistAccountDeletionCode = async (user) => {
  const code = generateEmailCode();
  user.accountDeletionCodeHash = hashEmailCode(code);
  user.accountDeletionExpiresAt = new Date(
    Date.now() + ACCOUNT_DELETION_CODE_TTL_MS,
  );
  user.accountDeletionLastSentAt = new Date();
  await user.save();
  return code;
};

const clearAccountDeletionState = async (user) => {
  user.accountDeletionCodeHash = undefined;
  user.accountDeletionExpiresAt = undefined;
  user.accountDeletionLastSentAt = undefined;
  await user.save();
};

const hasActiveAccountDeletionRequest = (user) =>
  Boolean(
    user.accountDeletionCodeHash &&
      user.accountDeletionExpiresAt &&
      user.accountDeletionExpiresAt > new Date(),
  );

export const buildAccountDeletionResponse = (user, message) => ({
  message,
  email: user.email,
  expiresAt:
    user.accountDeletionExpiresAt?.getTime?.() ||
    Date.now() + ACCOUNT_DELETION_CODE_TTL_MS,
  resendAvailableAt:
    (user.accountDeletionLastSentAt?.getTime?.() || Date.now()) +
    ACCOUNT_DELETION_RESEND_COOLDOWN_MS,
});

const getVerificationMessage = (purpose) =>
  purpose === "signup"
    ? "ÄÃ£ gá»­i mÃ£ xÃ¡c minh tá»›i email cá»§a báº¡n. Vui lÃ²ng xÃ¡c minh trÆ°á»›c khi Ä‘Äƒng nháº­p."
    : "ÄÃ£ gá»­i mÃ£ xÃ¡c minh tá»›i Gmail cá»§a báº¡n.";

export const sendEmailVerificationForUser = async (
  user,
  purpose,
  options = { ignoreCooldown: false },
) => {
  if (!isMailConfigured()) {
    return {
      ok: false,
      status: 500,
      message: "Há»‡ thá»‘ng chÆ°a cáº¥u hÃ¬nh SMTP Ä‘á»ƒ gá»­i mÃ£ xÃ¡c minh email.",
    };
  }

  if (!options.ignoreCooldown) {
    const cooldown = canResendVerification(user);
    if (!cooldown.ok) {
      return {
        ok: false,
        status: 429,
        message: "Báº¡n chá»‰ cÃ³ thá»ƒ gá»­i láº¡i mÃ£ sau 60 giÃ¢y.",
        resendAvailableAt: cooldown.resendAvailableAt,
      };
    }
  }

  const code = await persistVerificationCode(user);
  await sendVerificationCodeEmail({
    email: user.email,
    code,
    displayName: user.displayName,
  });

  return {
    ok: true,
    payload: buildPendingVerificationResponse(
      user,
      purpose,
      getVerificationMessage(purpose),
    ),
  };
};

export const sendAccountDeletionCodeForUser = async (
  user,
  options = { ignoreCooldown: false },
) => {
  if (!isMailConfigured()) {
    return {
      ok: false,
      status: 500,
      message: "Há»‡ thá»‘ng chÆ°a cáº¥u hÃ¬nh SMTP Ä‘á»ƒ gá»­i mÃ£ xÃ¡c minh xÃ³a tÃ i khoáº£n.",
    };
  }

  if (
    user.accountDeletionExpiresAt &&
    user.accountDeletionExpiresAt <= new Date() &&
    (user.accountDeletionCodeHash || user.accountDeletionLastSentAt)
  ) {
    await clearAccountDeletionState(user);
  }

  if (hasActiveAccountDeletionRequest(user) && !options.ignoreCooldown) {
    const cooldown = canResendAccountDeletionCode(user);
    if (!cooldown.ok) {
      return {
        ok: true,
        payload: buildAccountDeletionResponse(
          user,
          "Báº¡n Ä‘ang cÃ³ má»™t yÃªu cáº§u xÃ³a tÃ i khoáº£n chÆ°a hoÃ n táº¥t. Vui lÃ²ng nháº­p mÃ£ xÃ¡c minh hoáº·c chá» trÆ°á»›c khi gá»­i láº¡i mÃ£.",
        ),
      };
    }
  }

  if (!options.ignoreCooldown) {
    const cooldown = canResendAccountDeletionCode(user);
    if (!cooldown.ok) {
      return {
        ok: false,
        status: 429,
        message: "Báº¡n chá»‰ cÃ³ thá»ƒ gá»­i láº¡i mÃ£ sau 60 giÃ¢y.",
        resendAvailableAt: cooldown.resendAvailableAt,
      };
    }
  }

  const code = await persistAccountDeletionCode(user);
  await sendAccountDeletionCodeEmail({
    email: user.email,
    code,
    displayName: user.displayName,
  });

  return {
    ok: true,
    payload: buildAccountDeletionResponse(
      user,
      "ÄÃ£ gá»­i mÃ£ xÃ¡c minh xÃ³a tÃ i khoáº£n tá»›i email cá»§a báº¡n. MÃ£ cÃ³ hiá»‡u lá»±c trong 5 phÃºt.",
    ),
  };
};

export const verifyPendingToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    if (decoded.type !== "email-verification") {
      return { ok: false, status: 401, message: "Sai loáº¡i verification token." };
    }

    return { ok: true, decoded };
  } catch {
    return { ok: false, status: 401, message: "Verification token khÃ´ng há»£p lá»‡." };
  }
};

export const hashVerificationCode = hashEmailCode;

export const getUserById = (userId) => User.findById(userId);
