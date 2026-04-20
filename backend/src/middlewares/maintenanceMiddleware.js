import { isMaintenanceEnabled, getMaintenanceMessage } from "../services/maintenanceService.js";
import jwt from "jsonwebtoken";

const MAINTENANCE_ERROR_CODE = "MAINTENANCE_MODE";

export const maintenanceCheckMiddleware = async (req, res, next) => {
  try {
    // Skip maintenance check for admin and auth routes
    const isAdminRoute = req.path.startsWith("/api/admin");
    if (isAdminRoute) {
      return next();
    }

    const isAuthRoute = req.path.startsWith("/api/auth");
    if (isAuthRoute) {
      return next();
    }

    // If user has authorization token, let protectedRoute middleware handle maintenance check
    // (it will check user role there)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      return next();
    }

    // For unauthenticated requests to protected routes, block if maintenance is enabled
    const maintenanceEnabled = await isMaintenanceEnabled();
    if (!maintenanceEnabled) {
      return next();
    }

    // Maintenance is enabled - block all unauthenticated requests
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
