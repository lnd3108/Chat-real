import jwt from "jsonwebtoken";

import User from "../../../models/User.js";
import { serializeUserAccess } from "../../../shared/domain/rbac/access-policy.js";
import { resolveMaintenanceAccess } from "../../system/application/maintenance-access.service.js";

const bannedResponse = {
  status: 403,
  code: "ACCOUNT_BANNED",
  message: "Tài khoản của bạn đã bị khóa.",
};

const createFailure = (status, message, code, extra = {}) => ({
  ok: false,
  status,
  message,
  code,
  ...extra,
});

export const extractAccessTokenFromHttpRequest = (req) => {
  const authHeader = req?.headers?.authorization;
  const bearerToken = authHeader && authHeader.split(" ")[1];
  return bearerToken || req?.cookies?.accessToken || null;
};

export const extractAccessTokenFromSocket = (socket) =>
  socket?.handshake?.auth?.token || null;

export const resolveAccessUserFromToken = async ({
  token,
  path,
  isAuthRoute = false,
}) => {
  if (!token) {
    return createFailure(401, "Không tìm thấy access token.", "TOKEN_MISSING");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return createFailure(403, "Access token đã hết hạn hoặc không hợp lệ.", "TOKEN_EXPIRED", {
        cause: error,
      });
    }

    return createFailure(403, "Access token đã hết hạn hoặc không hợp lệ.", "TOKEN_INVALID", {
      cause: error,
    });
  }

  const user = await User.findById(decoded.userId).select("-hashedPassword");
  if (!user) {
    return createFailure(404, "Người dùng không tồn tại.", "USER_NOT_FOUND");
  }

  const accessUser = serializeUserAccess(user.toObject());
  if (accessUser.status === "banned") {
    return {
      ok: false,
      ...bannedResponse,
      user: accessUser,
    };
  }

  const maintenance = await resolveMaintenanceAccess({
    user: accessUser,
    path,
    isAuthRoute,
  });

  if (!maintenance.allowed) {
    return createFailure(
      maintenance.status,
      maintenance.message,
      maintenance.code,
      { user: accessUser },
    );
  }

  return {
    ok: true,
    user: accessUser,
    decoded,
  };
};
