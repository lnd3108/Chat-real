import { resolveMaintenanceAccess } from "../modules/system/application/maintenance-access.service.js";

export const maintenanceCheckMiddleware = async (req, res, next) => {
  try {
    const isAuthRoute = req.path.startsWith("/api/auth");
    const authHeader = req.headers.authorization;

    if (authHeader) {
      return next();
    }

    const access = await resolveMaintenanceAccess({
      user: null,
      path: req.originalUrl || req.path,
      isAuthRoute,
    });

    if (access.allowed) {
      return next();
    }

    return res.status(access.status).json({
      code: access.code,
      message: access.message,
    });
  } catch (error) {
    console.error("Error in maintenanceCheckMiddleware:", error);
    return next();
  }
};
