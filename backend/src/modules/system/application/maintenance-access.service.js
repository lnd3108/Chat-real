import { hasAdminPanelAccess } from "../../../shared/domain/rbac/access-policy.js";
import {
  getMaintenanceMessage,
  isMaintenanceEnabled,
} from "./maintenance-mode.service.js";

const MAINTENANCE_ERROR_CODE = "MAINTENANCE_MODE";

export const shouldBypassMaintenance = ({ user, path, isAuthRoute = false }) => {
  if (isAuthRoute) {
    return true;
  }

  if (typeof path === "string" && path.startsWith("/api/admin")) {
    return true;
  }

  if (user && hasAdminPanelAccess(user)) {
    return true;
  }

  return false;
};

export const resolveMaintenanceAccess = async ({
  user,
  path,
  isAuthRoute = false,
}) => {
  if (shouldBypassMaintenance({ user, path, isAuthRoute })) {
    return { allowed: true };
  }

  const enabled = await isMaintenanceEnabled();
  if (!enabled) {
    return { allowed: true };
  }

  return {
    allowed: false,
    status: 503,
    code: MAINTENANCE_ERROR_CODE,
    message: await getMaintenanceMessage(),
  };
};
