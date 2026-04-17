import jwt from "jsonwebtoken";
import User from "../models/User.js";

const createSocketAuthError = (message, code) => {
  const error = new Error(message);
  error.data = { code };
  return error;
};

export const socketAuthMiddleWare = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(createSocketAuthError("Unauthorized - Missing token", "TOKEN_MISSING"));
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    if (!decoded) {
      return next(createSocketAuthError("Unauthorized - Invalid token", "TOKEN_INVALID"));
    }

    const user = await User.findById(decoded.userId).select("-_hashedPassword");

    if (!user) {
      return next(createSocketAuthError("User not found", "USER_NOT_FOUND"));
    }

    socket.user = user;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(createSocketAuthError("Access token expired", "TOKEN_EXPIRED"));
    }

    console.error("Loi khi verify JWT trong socketMiddleWare", error);
    next(createSocketAuthError("Unauthorized", "TOKEN_INVALID"));
  }
};
