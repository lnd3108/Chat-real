import { hasAdminPanelAccess } from "../../../services/rbacService.js";
import {
  getPublicMaintenanceConfig,
  isMaintenanceL1CacheEnabled,
} from "../../../services/maintenanceService.js";
import { elapsedMs, nowMs } from "./auth-timing.js";

// Middleware kiem tra neu he thong dang trong che do bao tri
export const ensureMaintenanceAccess = async (user, timing = null) => {
  const decisionStartedAt = nowMs();
  if (user && hasAdminPanelAccess(user)) {
    if (timing) {
      timing.maintenanceReadMs = 0;
      timing.maintenanceDecisionMs = elapsedMs(decisionStartedAt);
      timing.maintenanceL1Enabled = isMaintenanceL1CacheEnabled();
      timing.maintenanceL1Hit = false;
      timing.maintenanceSource = "bypass_admin";
      timing.maintenanceSingleFlightShared = false;
    }
    return { allowed: true };
  }

  const readStartedAt = nowMs();
  const maintenanceConfig = await getPublicMaintenanceConfig(timing);
  const maintenanceReadMs = elapsedMs(readStartedAt);
  if (maintenanceConfig.isEnabled !== true) {
    if (timing) {
      timing.maintenanceReadMs = maintenanceReadMs;
      timing.maintenanceDecisionMs = Math.max(
        0,
        elapsedMs(decisionStartedAt) - maintenanceReadMs,
      );
    }
    return { allowed: true };
  }

  if (timing) {
    timing.maintenanceReadMs = maintenanceReadMs;
    timing.maintenanceDecisionMs = Math.max(
      0,
      elapsedMs(decisionStartedAt) - maintenanceReadMs,
    );
  }
  return {
    allowed: false,
    status: 503,
    body: {
      code: "MAINTENANCE_MODE",
      message: maintenanceConfig.message,
    },
  };
};
