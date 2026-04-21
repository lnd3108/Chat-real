import crypto from "crypto";
import { generateNumericOtp } from "../utils/generateOtp.js";

export const PASSWORD_RESET_OTP_LENGTH = 6;
export const PASSWORD_RESET_OTP_TTL_MS = 5 * 60 * 1000;
export const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000;
export const PASSWORD_RESET_MAX_SENDS_PER_HOUR = 5;
export const PASSWORD_RESET_MAX_ATTEMPTS = 5;
export const PASSWORD_RESET_TOKEN_TTL_MS = 10 * 60 * 1000;

export const generatePasswordResetOtp = () =>
  generateNumericOtp(PASSWORD_RESET_OTP_LENGTH);

export const hashOtpValue = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

export const generatePasswordResetToken = () => crypto.randomBytes(48).toString("hex");

export const isOtpFormatValid = (value) => /^\d{6}$/.test(String(value || "").trim());
