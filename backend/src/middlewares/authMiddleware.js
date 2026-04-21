import jwt from "jsonwebtoken";

import User from "../models/User.js";
import { isMaintenanceEnabled, getMaintenanceMessage } from "../services/maintenanceService.js";
import {
  hasAdminPanelAccess,
  hasAnyPermission,
  hasPermission,
  serializeUserAccess,
} from "../services/rbacService.js";
import { logger } from "../utils/logger.js";

const bannedResponse = {
  code: "ACCOUNT_BANNED",
  message: "Tài khoản của bạn đã bị khóa.",
};

export const protectedRoute = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.split(" ")[1];
    const token = bearerToken || req.cookies?.accessToken;

    if (!token) {
      return res.status(401).json({ message: "Không tìm thấy access token." });
    }

    jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET,
      async (err, decodedUser) => {
        if (err) {
          logger.warn("Access token không hợp lệ hoặc đã hết hạn", {
            name: err?.name,
            message: err?.message,
          });
          return res.status(403).json({
            message: "Access token hết hạn hoặc không hợp lệ.",
          });
        }

        try {
          const user = await User.findById(decodedUser.userId).select("-hashedPassword");

          if (!user) {
            return res.status(404).json({ message: "Người dùng không tồn tại." });
          }

          const accessUser = serializeUserAccess(user.toObject());

          if (accessUser.status === "banned") {
            return res.status(403).json(bannedResponse);
          }

          if (!hasAdminPanelAccess(accessUser)) {
            const maintenanceEnabled = await isMaintenanceEnabled();
            if (maintenanceEnabled) {
              const message = await getMaintenanceMessage();
              return res.status(503).json({
                code: "MAINTENANCE_MODE",
                message,
              });
            }
          }

          req.user = accessUser;
          return next();
        } catch (dbError) {
          logger.error("Lỗi trong protectedRoute callback", {
            name: dbError?.name,
            message: dbError?.message,
            code: dbError?.code,
          });
          return res.status(500).json({ message: "Lỗi hệ thống." });
        }
      },
    );
  } catch (error) {
    logger.error("Lỗi xác minh jwt trong authMiddleware", {
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
