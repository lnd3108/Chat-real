import { hasAdminPanelAccess } from "../../../services/rbacService.js";
import {
  getMaintenanceMessage,
  isMaintenanceEnabled,
} from "../../../services/maintenanceService.js";

// Middleware kiểm tra nếu hệ thống đang trong chế độ bảo trì
export const ensureMaintenanceAccess = async (user) => {
  if (user && hasAdminPanelAccess(user)) {
    return { allowed: true };
  }

  // Nếu không phải admin, kiểm tra xem hệ thống có đang trong chế độ bảo trì hay không
  const maintenanceEnabled = await isMaintenanceEnabled();
  if (!maintenanceEnabled) {
    return { allowed: true };
  }

  // Nếu đang trong chế độ bảo trì, trả về lỗi 503 với thông báo phù hợp
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
