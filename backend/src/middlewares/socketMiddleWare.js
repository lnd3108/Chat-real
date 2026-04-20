import jwt from "jsonwebtoken";

import User from "../models/User.js";
import { isMaintenanceEnabled, getMaintenanceMessage } from "../services/maintenanceService.js";

const createSocketAuthError = (message, code) => {
  const error = new Error(message);
  error.data = { code };
  return error;
};

export const socketAuthMiddleWare = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(
        createSocketAuthError("Chưa có token xác thực", "TOKEN_MISSING"),
      );
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    if (!decoded) {
      return next(
        createSocketAuthError("Token xác thực không hợp lệ", "TOKEN_INVALID"),
      );
    }

    const user = await User.findById(decoded.userId).select("-hashedPassword");
    if (!user) {
      return next(
        createSocketAuthError("Không tìm thấy người dùng", "USER_NOT_FOUND"),
      );
    }

    if (user.status === "banned") {
      return next(
        createSocketAuthError("Tài khoản đã bị khóa", "ACCOUNT_BANNED"),
      );
    }

    // Check maintenance mode for non-admin users
    if (user.role !== "admin") {
      const maintenanceEnabled = await isMaintenanceEnabled();
      if (maintenanceEnabled) {
        const message = await getMaintenanceMessage();
        return next(
          createSocketAuthError(message, "MAINTENANCE_MODE"),
        );
      }
    }

    socket.user = user;
    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(
        createSocketAuthError("Access token đã hết hạn", "TOKEN_EXPIRED"),
      );
    }

    console.error("Lỗi verify JWT trong socketMiddleWare", error);
    return next(
      createSocketAuthError("Không thể xác thực socket", "TOKEN_INVALID"),
    );
  }
};
