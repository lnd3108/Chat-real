import {
  hasAdminPanelAccess,
  hasAnyPermission,
  hasPermission,
} from "../../../../shared/domain/rbac/access-policy.js";
import { logger } from "../../../../shared/infrastructure/logger/logger.js";
import {
  extractAccessTokenFromHttpRequest,
  resolveAccessUserFromToken,
} from "../../application/resolve-access-user-from-token.js";

export const protectedRoute = async (req, res, next) => {
  try {
    const result = await resolveAccessUserFromToken({
      token: extractAccessTokenFromHttpRequest(req),
      path: req.originalUrl || req.path,
    });

    if (!result.ok) {
      if (result.cause) {
        logger.warn("Access token không hợp lệ hoặc đã hết hạn", {
          name: result.cause?.name,
          message: result.cause?.message,
          code: result.code,
        });
      }

      return res.status(result.status).json({
        ...(result.code ? { code: result.code } : {}),
        message: result.message,
      });
    }

    req.user = result.user;
    return next();
  } catch (error) {
    logger.error("Lỗi xác minh access user trong auth middleware", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "Lỗi hệ thống." });
  }
};

export const requireAdmin = (req, res, next) => {
  if (hasAdminPanelAccess(req.user)) {
    return next();
  }

  return res.status(403).json({
    message: "Bạn không có quyền truy cập khu vực quản trị.",
  });
};

export const requirePermission = (permission) => (req, res, next) => {
  if (hasPermission(req.user, permission)) {
    return next();
  }

  return res.status(403).json({
    message: "Bạn không có quyền thực hiện thao tác này.",
  });
};

export const requireAnyPermission = (permissions = []) => (req, res, next) => {
  if (hasAnyPermission(req.user, permissions)) {
    return next();
  }

  return res.status(403).json({
    message: "Bạn không có quyền thực hiện thao tác này.",
  });
};
