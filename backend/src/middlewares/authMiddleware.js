import jwt from "jsonwebtoken";

import User from "../models/User.js";

const bannedResponse = {
  code: "ACCOUNT_BANNED",
  message: "Tài khoản của bạn đã bị khóa.",
};

export const protectedRoute = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Không tìm thấy access token." });
    }

    jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET,
      async (err, decodedUser) => {
        if (err) {
          console.error(err);
          return res
            .status(403)
            .json({ message: "Access token hết hạn hoặc không hợp lệ." });
        }

        const user = await User.findById(decodedUser.userId).select("-hashedPassword");

        if (!user) {
          return res.status(404).json({ message: "Người dùng không tồn tại." });
        }

        if (user.status === "banned") {
          return res.status(403).json(bannedResponse);
        }

        req.user = user;
        return next();
      },
    );
  } catch (error) {
    console.error("Lỗi xác minh jwt trong authMiddleware", error);
    return res.status(500).json({ message: "Lỗi hệ thống." });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role === "admin") {
    return next();
  }

  return res.status(403).json({
    message: "Bạn không có quyền admin để thực hiện thao tác này.",
  });
};
