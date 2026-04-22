import User from "../../../models/User.js";
import {
  disconnectAllUserSockets,
  getIo,
} from "../../../socket/index.js";
import { isMailConfigured } from "../../../utils/mail.js";
import {
  getMaintenanceStatus,
  verifyPasswordAndPrepareConfirmation,
  sendConfirmationCode,
  verifyConfirmationCode,
  toggleMaintenanceMode,
  updateMaintenanceMessage as updateMaintenanceMessageInDb,
} from "../../../services/maintenanceService.js";
import {
  ADMIN_SOCKET_EVENTS,
  USER_SOCKET_EVENTS,
} from "../../../constants/socketEvents.js";
import { emitToAdmins } from "../../../shared/infrastructure/realtime/admin-room.js";
import {
  buildAdminActor,
  emitAdminNotification,
} from "../../../services/adminNotificationService.js";
import { emitDashboardStatsUpdated } from "../../../services/dashboardRealtimeService.js";

export const getSystemHealthSummary = async () => {
  const health = {
    status: "healthy",
    checks: {
      database: true,
      smtp: isMailConfigured(),
    },
  };

  if (!health.checks.smtp) {
    health.status = "warning";
    health.message = "SMTP chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh - khÃ´ng thá»ƒ gá»­i email";
  }

  return health;
};

export const getMaintenanceInfoQuery = async () => getMaintenanceStatus();

export const requestMaintenancePasswordVerificationCommand = async ({ adminId }) => {
  const admin = await User.findById(adminId).select("hashedPassword email");

  if (!admin) {
    const error = new Error("KhÃ´ng tÃ¬m tháº¥y quáº£n trá»‹ viÃªn");
    error.status = 404;
    throw error;
  }

  return {
    message:
      "YÃªu cáº§u xÃ¡c minh máº­t kháº©u Ä‘Ã£ Ä‘Æ°á»£c táº¡o. Vui lÃ²ng kiá»ƒm tra email.",
    email: admin.email,
  };
};

export const verifyMaintenancePasswordCommand = async ({ adminId, password }) => {
  if (!password) {
    const error = new Error("Thiáº¿u máº­t kháº©u");
    error.status = 400;
    throw error;
  }

  const admin = await User.findById(adminId).select("hashedPassword email");
  if (!admin) {
    const error = new Error("KhÃ´ng tÃ¬m tháº¥y quáº£n trá»‹ viÃªn");
    error.status = 404;
    throw error;
  }

  const isPasswordValid = await verifyPasswordAndPrepareConfirmation(
    password,
    admin.hashedPassword,
  );

  if (!isPasswordValid) {
    const error = new Error("Máº­t kháº©u khÃ´ng chÃ­nh xÃ¡c");
    error.status = 401;
    throw error;
  }

  const result = await sendConfirmationCode(admin.email);
  if (!result.ok) {
    const error = new Error(result.message);
    error.status = 500;
    throw error;
  }

  return {
    message: "MÃ£ xÃ¡c nháº­n Ä‘Ã£ Ä‘Æ°á»£c gá»­i tá»›i email cá»§a báº¡n",
    expiresAt: result.expiresAt,
  };
};

export const confirmMaintenanceToggleCommand = async ({ adminId, code, enable }) => {
  if (!code || typeof enable !== "boolean") {
    const error = new Error("Thiáº¿u code hoáº·c giÃ¡ trá»‹ enable");
    error.status = 400;
    throw error;
  }

  const verifyResult = await verifyConfirmationCode(code);
  if (!verifyResult.ok) {
    const error = new Error(verifyResult.message);
    error.status = 400;
    error.payload = {
      message: verifyResult.message,
      attempts: verifyResult.attempts,
      maxAttempts: verifyResult.maxAttempts,
    };
    throw error;
  }

  const result = await toggleMaintenanceMode(adminId, enable);

  if (enable) {
    disconnectAllUserSockets(result.message);
  }

  const actor = await User.findById(adminId).select(
    "displayName userName email avatarUrl role status createdAt",
  );
  const maintenancePayload = {
    isEnabled: result.isEnabled,
    message: result.message,
    enabledAt: result.enabledAt,
    disabledAt: result.disabledAt,
    actor: buildAdminActor(actor),
    createdAt: new Date().toISOString(),
  };

  emitToAdmins(
    enable
      ? ADMIN_SOCKET_EVENTS.MAINTENANCE_ON
      : ADMIN_SOCKET_EVENTS.MAINTENANCE_OFF,
    maintenancePayload,
  );
  emitAdminNotification({
    type: "system",
    title: enable ? "ÄÃ£ báº­t maintenance mode" : "ÄÃ£ táº¯t maintenance mode",
    message: enable
      ? `${actor?.displayName ?? "Admin"} vá»«a báº­t cháº¿ Ä‘á»™ báº£o trÃ¬`
      : `${actor?.displayName ?? "Admin"} vá»«a táº¯t cháº¿ Ä‘á»™ báº£o trÃ¬`,
    link: "/admin/maintenance",
    actor: buildAdminActor(actor),
    severity: enable ? "warning" : "success",
  });
  getIo().emit(
    enable
      ? USER_SOCKET_EVENTS.SYSTEM_MAINTENANCE_ON
      : USER_SOCKET_EVENTS.SYSTEM_MAINTENANCE_OFF,
    { message: result.message, isEnabled: result.isEnabled },
  );
  await emitDashboardStatsUpdated({
    reason: enable ? "maintenance:on" : "maintenance:off",
  });

  return {
    message: enable
      ? "Báº£o trÃ¬ há»‡ thá»‘ng Ä‘Ã£ Ä‘Æ°á»£c báº­t"
      : "Báº£o trÃ¬ há»‡ thá»‘ng Ä‘Ã£ Ä‘Æ°á»£c táº¯t",
    isEnabled: result.isEnabled,
    enabledAt: result.enabledAt,
    disabledAt: result.disabledAt,
  };
};

export const updateMaintenanceMessageCommand = async ({ message }) => {
  if (!message || typeof message !== "string" || !message.trim()) {
    const error = new Error("Tin nháº¯n báº£o trÃ¬ khÃ´ng há»£p lá»‡");
    error.status = 400;
    throw error;
  }

  const result = await updateMaintenanceMessageInDb(message.trim());
  await emitDashboardStatsUpdated({ reason: "maintenance:message-updated" });

  return {
    message: "Tin nháº¯n báº£o trÃ¬ Ä‘Ã£ Ä‘Æ°á»£c cáº­p nháº­t",
    maintenanceMessage: result.message,
  };
};
