import { hasAdminPanelAccess } from "../../../services/rbacService.js";
import {
  getMaintenanceMessage,
  isMaintenanceEnabled,
} from "../../../services/maintenanceService.js";

export const ensureMaintenanceAccess = async (user) => {
  if (user && hasAdminPanelAccess(user)) {
    return { allowed: true };
  }

  const maintenanceEnabled = await isMaintenanceEnabled();
  if (!maintenanceEnabled) {
    return { allowed: true };
  }

  const message = await getMaintenanceMessage();
  return {
    allowed: false,
    status: 503,
    body: {
      code: "MAINTENANCE_MODE",
      message,
    },
  };
};
