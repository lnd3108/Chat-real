import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protectedRoute = (req, res, next) => {
  try {
    // lấy token từ header
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Không tìm thấy access Token" });
    }

    jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET,
      async (err, decodedUser) => {
        if (err) {
          console.error(err);

          return res
            .status(403)
            .json({ message: "access Token Hết hạn hoặc không đúng" });
        }

        const user = await User.findById(decodedUser.userId).select(
          "-hashedPassword"
        );

        if (!user) {
          return res.status(404).json({ message: "Người dùng không tồn tại" });
        }

        req.user = user;
        next();
      }
    );
  } catch (error) {
    console.error("Lỗi Khi xác minh jwt trong authMiddleware", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
