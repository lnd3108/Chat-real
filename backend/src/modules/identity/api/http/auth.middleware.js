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
        logger.warn("Access token khong hop le hoac da het han", {
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
    logger.error("Loi xac minh access user trong auth middleware", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "Loi he thong." });
  }
};

export const requireAdmin = (req, res, next) => {
  if (hasAdminPanelAccess(req.user)) {
    return next();
  }

  return res.status(403).json({
    message: "Ban khong co quyen truy cap khu vuc quan tri.",
  });
};

export const requirePermission = (permission) => (req, res, next) => {
  if (hasPermission(req.user, permission)) {
    return next();
  }

  return res.status(403).json({
    message: "Ban khong co quyen thuc hien thao tac nay.",
  });
};

export const requireAnyPermission = (permissions = []) => (req, res, next) => {
  if (hasAnyPermission(req.user, permissions)) {
    return next();
  }

  return res.status(403).json({
    message: "Ban khong co quyen thuc hien thao tac nay.",
  });
};
