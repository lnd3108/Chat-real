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
import { buildBannedResponse, isUserBanned } from "../domain/auth-access.policy.js";
import {
  buildPendingVerificationResponse,
  sendEmailVerificationForUser,
} from "./verification.service.js";

export const signInUser = async ({ userName, password, res }) => {
  const user = await User.findOne({ userName: userName.toLowerCase() });
  if (!user) {
    return {
      status: 401,
      body: {
        message:
          "TÃƒÂªn tÃƒÂ i khoÃ¡ÂºÂ£n hoÃ¡ÂºÂ·c mÃ¡ÂºÂ­t khÃ¡ÂºÂ©u khÃƒÂ´ng chÃƒÂ­nh xÃƒÂ¡c.",
      },
    };
  }

  const passwordCorrect = await bcrypt.compare(password, user.hashedPassword);
  if (!passwordCorrect) {
    return {
      status: 401,
      body: {
        message:
          "TÃƒÂªn tÃƒÂ i khoÃ¡ÂºÂ£n hoÃ¡ÂºÂ·c mÃ¡ÂºÂ­t khÃ¡ÂºÂ©u khÃƒÂ´ng chÃƒÂ­nh xÃƒÂ¡c.",
      },
    };
  }

  if (isUserBanned(user)) {
    return { status: 403, body: buildBannedResponse() };
  }

  const maintenanceStatus = await ensureMaintenanceAccess(user);
  if (!maintenanceStatus.allowed) {
    return maintenanceStatus;
  }

  if (user.authProvider === "local" && !user.emailVerified) {
    const verification = await sendEmailVerificationForUser(user, "signup", {
      ignoreCooldown: false,
    });

    if (verification.ok) {
      return {
        status: 200,
        body: {
          ...verification.payload,
          message:
            "Email cÃ¡Â»Â§a bÃ¡ÂºÂ¡n chÃ†Â°a Ã„â€˜Ã†Â°Ã¡Â»Â£c xÃƒÂ¡c minh. ChÃƒÂºng tÃƒÂ´i Ã„â€˜ÃƒÂ£ gÃ¡Â»Â­i lÃ¡ÂºÂ¡i mÃƒÂ£ xÃƒÂ¡c minh.",
        },
      };
    }

    if (verification.status === 429) {
      return {
        status: 200,
        body: {
          ...buildPendingVerificationResponse(
            user,
            "signup",
            "Email cÃ¡Â»Â§a bÃ¡ÂºÂ¡n chÃ†Â°a Ã„â€˜Ã†Â°Ã¡Â»Â£c xÃƒÂ¡c minh. Vui lÃƒÂ²ng tiÃ¡ÂºÂ¿p tÃ¡Â»Â¥c xÃƒÂ¡c minh trÃ†Â°Ã¡Â»â€ºc khi Ã„â€˜Ã„Æ’ng nhÃ¡ÂºÂ­p.",
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

  const accessToken = await createSession(user._id, res);
  emitAuthLifecycle(ADMIN_SOCKET_EVENTS.USER_LOGIN, user);
  return {
    status: 200,
    body: buildAuthResponse(user, accessToken),
  };
};

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

export const refreshAccessToken = async ({ refreshToken, res }) => {
  if (!refreshToken) {
    return {
      status: 401,
      body: { message: "Token khÃƒÂ´ng tÃ¡Â»â€œn tÃ¡ÂºÂ¡i." },
    };
  }

  const session = await Session.findOne({ refreshToken });
  if (!session) {
    return {
      status: 403,
      body: { message: "Token khÃƒÂ´ng hÃ¡Â»Â£p lÃ¡Â»â€¡ hoÃ¡ÂºÂ·c Ã„â€˜ÃƒÂ£ hÃ¡ÂºÂ¿t hÃ¡ÂºÂ¡n" },
    };
  }

  if (session.expiresAt < new Date()) {
    return { status: 403, body: { message: "Token Ã„â€˜ÃƒÂ£ hÃ¡ÂºÂ¿t hÃ¡ÂºÂ¡n" } };
  }

  const user = await User.findById(session.userId).select("status role");
  if (!user) {
    await Session.deleteOne({ _id: session._id });
    return { status: 404, body: { message: "Nguoi dung khong ton tai." } };
  }

  if (isUserBanned(user)) {
    await Session.deleteMany({ userId: user._id });
    res.clearCookie("refreshToken");
    return { status: 403, body: buildBannedResponse() };
  }

  const maintenanceStatus = await ensureMaintenanceAccess(user);
  if (!maintenanceStatus.allowed) {
    return maintenanceStatus;
  }

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
