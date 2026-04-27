import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../../../models/User.js";
import Session from "../../../models/Session.js";
import { ADMIN_SOCKET_EVENTS } from "../../../constants/socketEvents.js";
import {
  buildAuthResponse,
  buildAccessToken,
  createSession,
} from "../infrastructure/token.service.js";
import { emitAuthLifecycle } from "../infrastructure/auth-realtime.service.js";
import { ensureMaintenanceAccess } from "../infrastructure/maintenance-access.service.js";
import {
  buildBannedResponse,
  isUserBanned,
} from "../domain/auth-access.policy.js";
import {
  buildPendingVerificationResponse,
  sendEmailVerificationForUser,
} from "./verification.service.js";

// Hàm tiện ích để lấy địa chỉ IP từ request
export const signInUser = async ({ userName, password, res }) => {
  // Kiểm tra xem có đang trong thời gian bảo trì hay không
  const user = await User.findOne({ userName: userName.toLowerCase() });
  if (!user) {
    return {
      status: 401,
      body: {
        message: "Tên tài khoản hoặc mật khẩu không chính xác.",
      },
    };
  }

  // Kiểm tra mật khẩu
  const passwordCorrect = await bcrypt.compare(password, user.hashedPassword);
  if (!passwordCorrect) {
    return {
      status: 401,
      body: {
        message: "Tên tài khoản hoặc mật khẩu không chính xác.",
      },
    };
  }

  // Kiểm tra xem người dùng có bị cấm hay không
  if (isUserBanned(user)) {
    return { status: 403, body: buildBannedResponse() };
  }

  // Kiểm tra xem có đang trong thời gian bảo trì hay không
  const maintenanceStatus = await ensureMaintenanceAccess(user);
  if (!maintenanceStatus.allowed) {
    return maintenanceStatus;
  }

  // Kiểm tra xem email đã được xác minh chưa đối với tài khoản local
  if (user.authProvider === "local" && !user.emailVerified) {
    const verification = await sendEmailVerificationForUser(user, "signup", {
      ignoreCooldown: false,
    });

    // Nếu gửi lại mã xác minh thành công
    if (verification.ok) {
      return {
        status: 200,
        body: {
          ...verification.payload,
          message:
            "Email của bạn chưa được xác minh. Chúng tôi đã gửi lại mã xác minh.",
        },
      };
    }

    // Nếu đang trong thời gian cooldown gửi lại mã xác minh
    if (verification.status === 429) {
      return {
        status: 200,
        body: {
          ...buildPendingVerificationResponse(
            user,
            "signup",
            "Email của bạn chưa được xác minh. Vui lòng tiếp tục xác minh trước khi đăng nhập.",
          ),
          resendAvailableAt: verification.resendAvailableAt,
        },
      };
    }

    return {
      status: verification.status,
      body: {
        message: verification.message,
        resendAvailableAt: verification.resendAvailableAt,
      },
    };
  }

  // Tạo phiên đăng nhập và trả về token
  const accessToken = await createSession(user._id, res);
  emitAuthLifecycle(ADMIN_SOCKET_EVENTS.USER_LOGIN, user);
  return {
    status: 200,
    body: buildAuthResponse(user, accessToken),
  };
};

// Hàm tiện ích để lấy payload từ ID token của Google
export const signOutUser = async ({ cookies, authorizationHeader, res }) => {
  const token = cookies?.refreshToken;
  let signedOutUser = null;

  if (authorizationHeader?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(
        authorizationHeader.slice("Bearer ".length),
        process.env.ACCESS_TOKEN_SECRET,
      );
      signedOutUser = await User.findById(decoded.userId).select(
        "displayName userName email avatarUrl role status createdAt",
      );
    } catch {
      signedOutUser = null;
    }
  }

  if (token) {
    await Session.deleteOne({ refreshToken: token });
    res.clearCookie("refreshToken");
  }

  res.clearCookie("accessToken");
  emitAuthLifecycle(ADMIN_SOCKET_EVENTS.USER_LOGOUT, signedOutUser);

  return { sendStatus: 204 };
};

// Hàm trao đổi mã code lấy token từ Google
export const refreshAccessToken = async ({ refreshToken, res }) => {
  if (!refreshToken) {
    return {
      status: 401,
      body: { message: "Token không tồn tại." },
    };
  }

  // Tìm phiên đăng nhập dựa trên refresh token
  const session = await Session.findOne({ refreshToken });
  if (!session) {
    return {
      status: 403,
      body: { message: "Token không hợp lệ hoặc đã hết hạn" },
    };
  }

  // Kiểm tra xem token đã hết hạn chưa
  if (session.expiresAt < new Date()) {
    return { status: 403, body: { message: "Token đã hết hạn" } };
  }

  // Tìm người dùng liên kết với phiên đăng nhập
  const user = await User.findById(session.userId).select("status role");
  if (!user) {
    await Session.deleteOne({ _id: session._id });
    return { status: 404, body: { message: "Người dùng không tồn tại." } };
  }

  // Kiểm tra xem người dùng có bị cấm hay không
  if (isUserBanned(user)) {
    await Session.deleteMany({ userId: user._id });
    res.clearCookie("refreshToken");
    return { status: 403, body: buildBannedResponse() };
  }

  // Kiểm tra xem có đang trong thời gian bảo trì hay không
  const maintenanceStatus = await ensureMaintenanceAccess(user);
  if (!maintenanceStatus.allowed) {
    return maintenanceStatus;
  }

  // Tạo access token mới và gửi về client
  const accessToken = buildAccessToken(session.userId);
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 30 * 60 * 1000,
  });

  return {
    status: 200,
    body: { accessToken },
  };
};
