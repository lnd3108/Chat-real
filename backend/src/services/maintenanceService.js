import crypto from "crypto";
import Maintenance from "../models/Maintenance.js";
import { sendMaintenanceConfirmationCodeEmail } from "../utils/mail.js";

const CONFIRMATION_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CONFIRMATION_ATTEMPTS = 5;
const CONFIRMATION_ATTEMPT_LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes
const PASSWORD_VERIFICATION_TTL_MS = 5 * 60 * 1000; // 5 minutes

const generateConfirmationCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

const hashCode = (code) =>
  crypto.createHash("sha256").update(code).digest("hex");

// Get or create the single maintenance document
export const getMaintenanceConfig = async () => {
  let config = await Maintenance.findOne();
  if (!config) {
    config = await Maintenance.create({
      isEnabled: false,
      message:
        "Hệ thống đang bảo trì, hãy quay lại sau 1 tiếng nữa nhé, rất xin lỗi vì sự làm phiền này nhưng chúng tôi cần bảo trì để nâng cao trải nghiệm của bạn.",
    });
  }
  return config;
};

// Check if maintenance mode is enabled
export const isMaintenanceEnabled = async () => {
  const config = await getMaintenanceConfig();
  return config.isEnabled === true;
};

// Get maintenance message
export const getMaintenanceMessage = async () => {
  const config = await getMaintenanceConfig();
  return config.message;
};

// Step 1: Request password verification (admin enters password)
export const requestPasswordVerification = async (adminId) => {
  const config = await getMaintenanceConfig();

  // Create and store password verification hash
  const verificationCode = generateConfirmationCode();
  config.passwordVerificationHash = hashCode(verificationCode);
  config.passwordVerificationExpiresAt = new Date(
    Date.now() + PASSWORD_VERIFICATION_TTL_MS
  );
  await config.save();

  return verificationCode;
};

// Verify password and prepare for confirmation code
export const verifyPasswordAndPrepareConfirmation = async (
  providedPassword,
  adminHashedPassword
) => {
  const bcrypt = await import("bcrypt");

  const isValid = await bcrypt.default.compare(
    providedPassword,
    adminHashedPassword
  );
  return isValid;
};

// Step 2: Send confirmation code via email
export const sendConfirmationCode = async (adminEmail) => {
  try {
    const config = await getMaintenanceConfig();

    // Generate confirmation code
    const code = generateConfirmationCode();
    config.confirmationCodeHash = hashCode(code);
    config.confirmationExpiresAt = new Date(
      Date.now() + CONFIRMATION_CODE_TTL_MS
    );
    config.confirmationAttempts = 0;
    await config.save();

    // Send email
    await sendMaintenanceConfirmationCodeEmail({
      email: adminEmail,
      code,
    });

    return {
      ok: true,
      expiresAt: config.confirmationExpiresAt.getTime(),
    };
  } catch (error) {
    console.error("Error sending confirmation code:", error);
    return {
      ok: false,
      message: "Không thể gửi mã xác nhận, vui lòng thử lại.",
    };
  }
};

// Step 3: Verify confirmation code
export const verifyConfirmationCode = async (code) => {
  const config = await getMaintenanceConfig();

  // Check if code exists and not expired
  if (
    !config.confirmationCodeHash ||
    !config.confirmationExpiresAt ||
    config.confirmationExpiresAt < new Date()
  ) {
    return {
      ok: false,
      message: "Mã xác nhận đã hết hạn.",
    };
  }

  // Check lockout status
  if (config.confirmationAttempts >= MAX_CONFIRMATION_ATTEMPTS) {
    const lastAttempt = config.lastConfirmationAttemptAt?.getTime?.() || 0;
    const lockoutExpires = lastAttempt + CONFIRMATION_ATTEMPT_LOCKOUT_MS;

    if (Date.now() < lockoutExpires) {
      const remainingMinutes = Math.ceil((lockoutExpires - Date.now()) / 60000);
      return {
        ok: false,
        message: `Quá nhiều lần nhập sai. Vui lòng thử lại sau ${remainingMinutes} phút.`,
      };
    }

    // Reset lockout
    config.confirmationAttempts = 0;
  }

  // Verify code
  const providedCodeHash = hashCode(String(code).trim());
  if (providedCodeHash !== config.confirmationCodeHash) {
    config.confirmationAttempts += 1;
    config.lastConfirmationAttemptAt = new Date();
    await config.save();

    return {
      ok: false,
      message: "Mã xác nhận không đúng.",
      attempts: config.confirmationAttempts,
      maxAttempts: MAX_CONFIRMATION_ATTEMPTS,
    };
  }

  // Code is valid - clear confirmation state
  config.confirmationCodeHash = undefined;
  config.confirmationExpiresAt = undefined;
  config.confirmationAttempts = 0;
  config.lastConfirmationAttemptAt = undefined;
  config.passwordVerificationHash = undefined;
  config.passwordVerificationExpiresAt = undefined;
  await config.save();

  return { ok: true };
};

// Toggle maintenance mode (after verification)
export const toggleMaintenanceMode = async (adminId, shouldEnable) => {
  const config = await getMaintenanceConfig();

  if (shouldEnable) {
    config.isEnabled = true;
    config.enabledBy = adminId;
    config.enabledAt = new Date();
    config.disabledBy = undefined;
    config.disabledAt = undefined;
  } else {
    config.isEnabled = false;
    config.disabledBy = adminId;
    config.disabledAt = new Date();
    config.enabledBy = undefined;
    config.enabledAt = undefined;
  }

  await config.save();
  return config;
};

// Update maintenance message
export const updateMaintenanceMessage = async (message) => {
  const config = await getMaintenanceConfig();
  config.message = message;
  await config.save();
  return config;
};

// Get maintenance config (for admin dashboard)
export const getMaintenanceStatus = async () => {
  const config = await getMaintenanceConfig();
  return {
    isEnabled: config.isEnabled,
    message: config.message,
    enabledAt: config.enabledAt,
    enabledBy: config.enabledBy,
    disabledAt: config.disabledAt,
    disabledBy: config.disabledBy,
  };
};
