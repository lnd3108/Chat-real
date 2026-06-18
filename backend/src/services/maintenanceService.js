import crypto from "crypto";
import Maintenance from "../models/Maintenance.js";
import { sendMaintenanceConfirmationCodeEmail } from "../utils/mail.js";
import {
  buildKey,
  del,
  getJson,
  setJson,
} from "../shared/infrastructure/cache/cache.service.js";

const CONFIRMATION_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CONFIRMATION_ATTEMPTS = 5;
const CONFIRMATION_ATTEMPT_LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes
const PASSWORD_VERIFICATION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAINTENANCE_CACHE_KEY = buildKey("maintenance", "config");
const MAINTENANCE_CACHE_TTL_SECONDS = Number(
  process.env.MAINTENANCE_CACHE_TTL_SECONDS || 45,
);
const DEFAULT_MAINTENANCE_L1_CACHE_TTL_MS = 1000;

let maintenanceL1Cache = null;
let maintenanceSingleFlightPromise = null;
let maintenanceL1Version = 0;

export const isMaintenanceL1CacheEnabled = () =>
  process.env.MAINTENANCE_L1_CACHE_ENABLED === "true";

const getMaintenanceL1CacheTtlMs = () => {
  const value = Number(process.env.MAINTENANCE_L1_CACHE_TTL_MS);
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_MAINTENANCE_L1_CACHE_TTL_MS;
};

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

const serializePublicMaintenanceConfig = (config) => ({
  isEnabled: config.isEnabled,
  message: config.message,
  enabledAt: config.enabledAt,
  enabledBy: config.enabledBy,
  disabledAt: config.disabledAt,
  disabledBy: config.disabledBy,
});

const clonePublicMaintenanceConfig = (config) => ({ ...config });

const setMaintenanceTiming = (timing, data) => {
  if (timing) {
    Object.assign(timing, data);
  }
};

const getL1CacheEntry = () => {
  if (!isMaintenanceL1CacheEnabled() || !maintenanceL1Cache) {
    return null;
  }

  if (maintenanceL1Cache.expiresAt <= Date.now()) {
    maintenanceL1Cache = null;
    return null;
  }

  return maintenanceL1Cache;
};

const setL1CacheEntry = (config, version) => {
  if (!isMaintenanceL1CacheEnabled() || version !== maintenanceL1Version) {
    return;
  }

  maintenanceL1Cache = {
    value: clonePublicMaintenanceConfig(config),
    expiresAt: Date.now() + getMaintenanceL1CacheTtlMs(),
  };
};

const readPublicMaintenanceConfig = async () => {
  const cached = await getJson(MAINTENANCE_CACHE_KEY);
  if (cached !== null) {
    return {
      config: cached,
      source: "redis",
    };
  }

  const config = await getMaintenanceConfig();
  const publicConfig = serializePublicMaintenanceConfig(config);
  await setJson(
    MAINTENANCE_CACHE_KEY,
    publicConfig,
    MAINTENANCE_CACHE_TTL_SECONDS,
  );

  return {
    config: publicConfig,
    source: "mongo",
  };
};

export const getPublicMaintenanceConfig = async (timing = null) => {
  const l1Enabled = isMaintenanceL1CacheEnabled();
  setMaintenanceTiming(timing, {
    maintenanceL1Enabled: l1Enabled,
    maintenanceL1Hit: false,
    maintenanceSingleFlightShared: false,
  });

  const l1Entry = getL1CacheEntry();
  if (l1Entry) {
    setMaintenanceTiming(timing, {
      maintenanceL1Hit: true,
      maintenanceSource: "l1_memory",
    });
    return clonePublicMaintenanceConfig(l1Entry.value);
  }

  if (maintenanceSingleFlightPromise) {
    setMaintenanceTiming(timing, {
      maintenanceSource: "single_flight",
      maintenanceSingleFlightShared: true,
    });
    const result = await maintenanceSingleFlightPromise;
    setMaintenanceTiming(timing, {
      maintenanceSource: result.source,
    });
    return clonePublicMaintenanceConfig(result.config);
  }

  const version = maintenanceL1Version;
  maintenanceSingleFlightPromise = readPublicMaintenanceConfig()
    .then((result) => {
      setL1CacheEntry(result.config, version);
      return result;
    })
    .finally(() => {
      maintenanceSingleFlightPromise = null;
    });

  const result = await maintenanceSingleFlightPromise;
  setMaintenanceTiming(timing, {
    maintenanceSource: result.source,
  });
  return clonePublicMaintenanceConfig(result.config);
};

export const invalidateMaintenanceL1Cache = () => {
  maintenanceL1Version += 1;
  maintenanceL1Cache = null;
  maintenanceSingleFlightPromise = null;
};

export const invalidateMaintenanceCache = async () => {
  invalidateMaintenanceL1Cache();
  return del(MAINTENANCE_CACHE_KEY);
};

// Check if maintenance mode is enabled
export const isMaintenanceEnabled = async (timing = null) => {
  const config = await getPublicMaintenanceConfig(timing);
  return config.isEnabled === true;
};

// Get maintenance message
export const getMaintenanceMessage = async (timing = null) => {
  const config = await getPublicMaintenanceConfig(timing);
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
    if (!adminEmail) {
      throw new Error("Thiếu email quản trị viên");
    }

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
    try {
      await sendMaintenanceConfirmationCodeEmail({
        email: adminEmail,
        code,
      });
    } catch (emailError) {
      console.error("Email send failed in sendConfirmationCode:", {
        adminEmail,
        error: emailError.message,
        code: emailError.code,
      });
      // Delete the saved code if email fails
      config.confirmationCodeHash = undefined;
      config.confirmationExpiresAt = undefined;
      await config.save();
      throw emailError;
    }

    return {
      ok: true,
      expiresAt: config.confirmationExpiresAt.getTime(),
    };
  } catch (error) {
    console.error("Lỗi khi gửi mã xác nhận:", {
      error: error.message,
      code: error.code,
      stack: error.stack,
    });
    
    // Kiểm tra có phải lỗi cấu hình SMTP hay không
    const message = 
      error.message?.includes("SMTP") || error.message?.includes("configured")
        ? "Hệ thống email chưa được cấu hình. Vui lòng liên hệ với quản trị viên."
        : "Không thể gửi mã xác nhận, vui lòng thử lại.";

    return {
      ok: false,
      message,
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
  await invalidateMaintenanceCache();
  return config;
};

// Update maintenance message
export const updateMaintenanceMessage = async (message) => {
  const config = await getMaintenanceConfig();
  config.message = message;
  await config.save();
  await invalidateMaintenanceCache();
  return config;
};

// Get maintenance config (for admin dashboard)
export const getMaintenanceStatus = async () => {
  return getPublicMaintenanceConfig();
};
