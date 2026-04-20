import { isMaintenanceEnabled, getMaintenanceMessage } from "../services/maintenanceService.js";

const MAINTENANCE_ERROR_CODE = "MAINTENANCE_MODE";

export const maintenanceCheckMiddleware = async (req, res, next) => {
  try {
    // Allow admin routes to bypass maintenance check
    const isAdminRoute = req.path.startsWith("/api/admin");
    if (isAdminRoute) {
      return next();
    }

    const maintenanceEnabled = await isMaintenanceEnabled();
    if (!maintenanceEnabled) {
      return next();
    }

    // Maintenance is enabled - block all non-admin user requests
    const message = await getMaintenanceMessage();
    return res.status(503).json({
      code: MAINTENANCE_ERROR_CODE,
      message,
    });
  } catch (error) {
    console.error("Error in maintenanceCheckMiddleware:", error);
    return next();
  }
};
