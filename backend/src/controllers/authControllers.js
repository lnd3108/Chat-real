import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import Session from "../models/Session.js";
import { signInSchema, signUpSchema } from "../libs/validation.js";
import {
  isMailConfigured,
  sendVerificationCodeEmail,
  sendAccountDeletionCodeEmail,
} from "../utils/mail.js";
import { isMaintenanceEnabled, getMaintenanceMessage } from "../services/maintenanceService.js";
import { ADMIN_SOCKET_EVENTS } from "../constants/socketEvents.js";
import { emitToAdmins } from "../socket/adminSocket.js";
import { deleteMyAccount } from "./userController.js";
import {
  buildAdminActor,
  emitAdminNotification,
} from "../services/adminNotificationService.js";
import { emitDashboardStatsUpdated } from "../services/dashboardRealtimeService.js";
import { hasAdminPanelAccess } from "../services/rbacService.js";
import { logger } from "../utils/logger.js";
import { sanitizeAuthResponse } from "../utils/sanitizeUser.js";

const ACCESS_TOKEN_TTL = "30m";
const REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60 * 1000;
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_TOKEN_TTL = "10m";
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
const ACCOUNT_DELETION_CODE_TTL_MS = 5 * 60 * 1000;
const ACCOUNT_DELETION_RESEND_COOLDOWN_MS = 60 * 1000;

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const buildAccessToken = (userId) =>
  jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });

const buildBannedResponse = () => ({
  code: "ACCOUNT_BANNED",
  message: "Tài khoản của bạn đã bị khóa.",
});

const isUserBanned = (user) => user?.status === "banned";

const emitAdminUserLifecycle = (eventName, user, title, message, reason) => {
  if (!user || hasAdminPanelAccess(user)) {
    return;
  }

  emitToAdmins(eventName, {
    user: buildAdminActor(user),
    changedAt: new Date().toISOString(),
  });

  emitAdminNotification({
    type: "user",
    title,
    message,
    link: `/admin/users/${user._id}`,
    entityId: user._id.toString(),
    actor: buildAdminActor(user),
  });

  void emitDashboardStatsUpdated({ reason, userId: user._id.toString() });
};

const createSession = async (userId, res) => {
  const accessToken = buildAccessToken(userId);
  const refreshToken = crypto.randomBytes(64).toString("hex");

  await Session.create({
    userId,
    refreshToken,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL),
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: REFRESH_TOKEN_TTL,
  });

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 30 * 60 * 1000,
  });

  return accessToken;
};

const buildAuthResponse = (user, accessToken) => ({
  message: `Người dùng ${user.displayName} đã đăng nhập`,
  accessToken,
  user: sanitizeAuthResponse(user),
});

const createPendingVerificationToken = (user, purpose) =>
  jwt.sign(
    {
      userId: user._id,
      email: user.email,
      type: "email-verification",
      purpose,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: EMAIL_TOKEN_TTL },
  );

const buildPendingVerificationResponse = (user, purpose, message) => ({
  requiresEmailVerification: true,
  verificationToken: createPendingVerificationToken(user, purpose),
  email: user.email,
  purpose,
  resendAvailableAt:
    (user.emailVerificationLastSentAt?.getTime?.() || Date.now()) +
    EMAIL_RESEND_COOLDOWN_MS,
  message,
});

const generateEmailCode = () => String(Math.floor(100000 + Math.random() * 900000));

const hashEmailCode = (code) =>
  crypto.createHash("sha256").update(code).digest("hex");

const createUniqueUserName = async (email) => {
  const [baseValue] = email.split("@");
  const normalizedBase = baseValue
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);

  const base = normalizedBase.length >= 3 ? normalizedBase : "gmailuser";

  let candidate = base;
  let index = 0;

  while (await User.findOne({ userName: candidate })) {
    index += 1;
    candidate = `${base}${index}`.slice(0, 30);
  }

  return candidate;
};

const canResendVerification = (user) => {
  const lastSentAt = user.emailVerificationLastSentAt?.getTime?.();
  if (!lastSentAt) {
    return { ok: true, resendAvailableAt: Date.now() };
  }

  const resendAvailableAt = lastSentAt + EMAIL_RESEND_COOLDOWN_MS;
  if (Date.now() < resendAvailableAt) {
    return { ok: false, resendAvailableAt };
  }

  return { ok: true, resendAvailableAt };
};

const persistVerificationCode = async (user) => {
  const code = generateEmailCode();
  user.emailVerificationCodeHash = hashEmailCode(code);
  user.emailVerificationExpiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);
  user.emailVerificationLastSentAt = new Date();
  await user.save();
  return code;
};

const canResendAccountDeletionCode = (user) => {
  const lastSentAt = user.accountDeletionLastSentAt?.getTime?.();
  if (!lastSentAt) {
    return { ok: true, resendAvailableAt: Date.now() };
  }

  const resendAvailableAt = lastSentAt + ACCOUNT_DELETION_RESEND_COOLDOWN_MS;
  if (Date.now() < resendAvailableAt) {
    return { ok: false, resendAvailableAt };
  }

  return { ok: true, resendAvailableAt };
};

const persistAccountDeletionCode = async (user) => {
  const code = generateEmailCode();
  user.accountDeletionCodeHash = hashEmailCode(code);
  user.accountDeletionExpiresAt = new Date(
    Date.now() + ACCOUNT_DELETION_CODE_TTL_MS,
  );
  user.accountDeletionLastSentAt = new Date();
  await user.save();
  return code;
};

const clearAccountDeletionState = async (user) => {
  user.accountDeletionCodeHash = undefined;
  user.accountDeletionExpiresAt = undefined;
  user.accountDeletionLastSentAt = undefined;
  await user.save();
};

const hasActiveAccountDeletionRequest = (user) =>
  Boolean(
    user.accountDeletionCodeHash &&
      user.accountDeletionExpiresAt &&
      user.accountDeletionExpiresAt > new Date(),
  );

const buildAccountDeletionResponse = (user, message) => ({
  message,
  email: user.email,
  expiresAt:
    user.accountDeletionExpiresAt?.getTime?.() ||
    Date.now() + ACCOUNT_DELETION_CODE_TTL_MS,
  resendAvailableAt:
    (user.accountDeletionLastSentAt?.getTime?.() || Date.now()) +
    ACCOUNT_DELETION_RESEND_COOLDOWN_MS,
});

const getVerificationMessage = (purpose) =>
  purpose === "signup"
    ? "Đã gửi mã xác minh tới email của bạn. Vui lòng xác minh trước khi đăng nhập."
    : "Đã gửi mã xác minh tới Gmail của bạn.";

const sendEmailVerificationForUser = async (
  user,
  purpose,
  options = { ignoreCooldown: false },
) => {
  if (!isMailConfigured()) {
    return {
      ok: false,
      status: 500,
      message: "Hệ thống chưa cấu hình SMTP để gửi mã xác minh email.",
    };
  }

  if (!options.ignoreCooldown) {
    const cooldown = canResendVerification(user);
    if (!cooldown.ok) {
      return {
        ok: false,
        status: 429,
        message: "Bạn chỉ có thể gửi lại mã sau 60 giây.",
        resendAvailableAt: cooldown.resendAvailableAt,
      };
    }
  }

  const code = await persistVerificationCode(user);
  await sendVerificationCodeEmail({
    email: user.email,
    code,
    displayName: user.displayName,
  });

  return {
    ok: true,
    payload: buildPendingVerificationResponse(
      user,
      purpose,
      getVerificationMessage(purpose),
    ),
  };
};

const sendAccountDeletionCodeForUser = async (
  user,
  options = { ignoreCooldown: false },
) => {
  if (!isMailConfigured()) {
    return {
      ok: false,
      status: 500,
      message: "Hệ thống chưa cấu hình SMTP để gửi mã xác minh xóa tài khoản.",
    };
  }

  if (
    user.accountDeletionExpiresAt &&
    user.accountDeletionExpiresAt <= new Date() &&
    (user.accountDeletionCodeHash || user.accountDeletionLastSentAt)
  ) {
    await clearAccountDeletionState(user);
  }

  if (hasActiveAccountDeletionRequest(user) && !options.ignoreCooldown) {
    const cooldown = canResendAccountDeletionCode(user);
    if (!cooldown.ok) {
      return {
        ok: true,
        payload: buildAccountDeletionResponse(
          user,
          "Bạn đang có một yêu cầu xóa tài khoản chưa hoàn tất. Vui lòng nhập mã xác minh hoặc chờ trước khi gửi lại mã.",
        ),
      };
    }
  }

  if (!options.ignoreCooldown) {
    const cooldown = canResendAccountDeletionCode(user);
    if (!cooldown.ok) {
      return {
        ok: false,
        status: 429,
        message: "Bạn chỉ có thể gửi lại mã sau 60 giây.",
        resendAvailableAt: cooldown.resendAvailableAt,
      };
    }
  }

  const code = await persistAccountDeletionCode(user);
  await sendAccountDeletionCodeEmail({
    email: user.email,
    code,
    displayName: user.displayName,
  });

  return {
    ok: true,
    payload: buildAccountDeletionResponse(
      user,
      "Đã gửi mã xác minh xóa tài khoản tới email của bạn. Mã có hiệu lực trong 5 phút.",
    ),
  };
};

const verifyPendingToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    if (decoded.type !== "email-verification") {
      return { ok: false, status: 401, message: "Sai loại verification token." };
    }

    return { ok: true, decoded };
  } catch {
    return { ok: false, status: 401, message: "Verification token không hợp lệ." };
  }
};

const getGoogleAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

const exchangeGoogleCodeForTokens = async (code) => {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google token exchange failed: ${details}`);
  }

  return response.json();
};

const verifyGoogleIdToken = async (idToken) => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  return ticket.getPayload();
};

const ensureGoogleEmailIsAllowed = (payload) => {
  if (!payload?.email) {
    return "Tài khoản Google không trả về email.";
  }

  if (!payload.email_verified) {
    return "Google chưa xác minh email này.";
  }

  if (!payload.email.toLowerCase().endsWith("@gmail.com")) {
    return "Chỉ được đăng nhập bằng tài khoản Gmail.";
  }

  return null;
};

const findOrCreateGoogleUser = async (payload) => {
  const googleId = payload.sub;
  const email = payload.email.toLowerCase();

  let user = await User.findOne({ $or: [{ googleId }, { email }] });

  if (user) {
    if (user.googleId && user.googleId !== googleId) {
      throw new Error("Tài khoản này đã liên kết với Google khác.");
    }

    user.googleId = googleId;
    user.authProvider = "google";
    user.email = email;
    user.displayName = payload.name || user.displayName;
    if (!user.avatarUrl && payload.picture) {
      user.avatarUrl = payload.picture;
    }
    await user.save();
    return user;
  }

  const userName = await createUniqueUserName(email);
  const randomPassword = crypto.randomBytes(24).toString("hex");
  const hashedPassword = await bcrypt.hash(randomPassword, 10);

  return User.create({
    userName,
    hashedPassword,
    email,
    displayName: payload.name || userName,
    avatarUrl: payload.picture,
    authProvider: "google",
    googleId,
    emailVerified: false,
  });
};

export const signUp = async (req, res) => {
  try {
    // Check maintenance mode
    const maintenanceEnabled = await isMaintenanceEnabled();
    if (maintenanceEnabled) {
      const message = await getMaintenanceMessage();
      return res.status(503).json({
        code: "MAINTENANCE_MODE",
        message,
      });
    }

    const validatedData = signUpSchema.parse(req.body);
    const { userName, password, email, firstName, lastName } = validatedData;

    const normalizedUserName = userName.toLowerCase();
    const normalizedEmail = email.toLowerCase();

    const duplicate = await User.findOne({ userName: normalizedUserName });
    const duplicateEmail = await User.findOne({ email: normalizedEmail });

    const pendingUser =
      duplicate &&
      !duplicate.emailVerified &&
      duplicate.authProvider === "local" &&
      duplicate.email === normalizedEmail
        ? duplicate
        : duplicateEmail &&
            !duplicateEmail.emailVerified &&
            duplicateEmail.authProvider === "local"
          ? duplicateEmail
          : null;

    if (pendingUser) {
      const verification = await sendEmailVerificationForUser(pendingUser, "signup", {
        ignoreCooldown: false,
      });

      if (!verification.ok) {
        return res.status(verification.status).json({
          message: verification.message,
          resendAvailableAt: verification.resendAvailableAt,
        });
      }

      return res.status(200).json({
        ...verification.payload,
        message:
          "Tài khoản của bạn đang chờ xác minh email. Chúng tôi đã gửi lại mã xác minh.",
      });
    }

    if (duplicate) {
      return res.status(409).json({ message: "userName đã tồn tại" });
    }

    if (duplicateEmail) {
      return res.status(409).json({ message: "Email đã tồn tại" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      userName: normalizedUserName,
      hashedPassword,
      email: normalizedEmail,
      displayName: `${lastName} ${firstName}`,
      authProvider: "local",
      emailVerified: false,
    });

    emitAdminUserLifecycle(
      ADMIN_SOCKET_EVENTS.USER_NEW,
      user,
      "Nguoi dung moi dang ky",
      `${user.displayName} vua tao tai khoan`,
      "user:register",
    );

    const verification = await sendEmailVerificationForUser(user, "signup", {
      ignoreCooldown: true,
    });
    if (!verification.ok) {
      return res.status(verification.status).json({
        message: verification.message,
        resendAvailableAt: verification.resendAvailableAt,
      });
    }

    return res.status(201).json(verification.payload);
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Lỗi xác thực dữ liệu",
        errors: error.issues || error.errors,
      });
    }

    logger.error("Lỗi khi gọi signUp", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const signIn = async (req, res) => {
  try {
    const validatedData = signInSchema.parse(req.body);
    const { userName, password } = validatedData;

    const user = await User.findOne({ userName: userName.toLowerCase() });
    if (!user) {
      return res
        .status(401)
        .json({ message: "Tên tài khoản hoặc mật khẩu không chính xác." });
    }

    const passwordCorrect = await bcrypt.compare(password, user.hashedPassword);
    if (!passwordCorrect) {
      return res
        .status(401)
        .json({ message: "Tên tài khoản hoặc mật khẩu không chính xác." });
    }

    if (isUserBanned(user)) {
      return res.status(403).json(buildBannedResponse());
    }

    // Check maintenance mode - but allow admins to login
    if (!hasAdminPanelAccess(user)) {
      const maintenanceEnabled = await isMaintenanceEnabled();
      if (maintenanceEnabled) {
        const message = await getMaintenanceMessage();
        return res.status(503).json({
          code: "MAINTENANCE_MODE",
          message,
        });
      }
    }

    if (user.authProvider === "local" && !user.emailVerified) {
      const verification = await sendEmailVerificationForUser(user, "signup", {
        ignoreCooldown: false,
      });

      if (verification.ok) {
        return res.status(200).json({
          ...verification.payload,
          message:
            "Email của bạn chưa được xác minh. Chúng tôi đã gửi lại mã xác minh.",
        });
      }

      if (verification.status === 429) {
        return res.status(200).json({
          ...buildPendingVerificationResponse(
            user,
            "signup",
            "Email của bạn chưa được xác minh. Vui lòng tiếp tục xác minh trước khi đăng nhập.",
          ),
          resendAvailableAt: verification.resendAvailableAt,
        });
      }

      return res.status(verification.status).json({
        message: verification.message,
        resendAvailableAt: verification.resendAvailableAt,
      });
    }

    const accessToken = await createSession(user._id, res);
    emitAdminUserLifecycle(
      ADMIN_SOCKET_EVENTS.USER_LOGIN,
      user,
      "Người dùng đăng nhập",
      `${user.displayName} vừa đăng nhập`,
      "user:login",
    );
    return res.status(200).json(buildAuthResponse(user, accessToken));
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Loi xac thuc du lieu",
        errors: error.issues || error.errors,
      });
    }

    logger.error("Lỗi signIn", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const startGoogleAuth = async (_req, res) => {
  try {
    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GOOGLE_CALLBACK_URL
    ) {
      return res.status(500).json({
        message: "Google OAuth chưa được cấu hình đầy đủ.",
      });
    }

    return res.redirect(getGoogleAuthUrl());
  } catch (error) {
    logger.error("Lỗi startGoogleAuth", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "Không thể bắt đầu đăng nhập Google" });
  }
};

export const googleCallback = async (req, res) => {
  try {
    const { code } = req.body || {};

    if (!code) {
      return res.status(400).json({ message: "Thiếu code từ Google." });
    }

    const tokenResult = await exchangeGoogleCodeForTokens(code);
    const payload = await verifyGoogleIdToken(tokenResult.id_token);

    const googleEmailError = ensureGoogleEmailIsAllowed(payload);
    if (googleEmailError) {
      return res.status(400).json({ message: googleEmailError });
    }

    const user = await findOrCreateGoogleUser(payload);

    if (isUserBanned(user)) {
      return res.status(403).json(buildBannedResponse());
    }

    // Check maintenance mode - but allow admins to login
    if (!hasAdminPanelAccess(user)) {
      const maintenanceEnabled = await isMaintenanceEnabled();
      if (maintenanceEnabled) {
        const message = await getMaintenanceMessage();
        return res.status(503).json({
          code: "MAINTENANCE_MODE",
          message,
        });
      }
    }

    if (!user.emailVerified) {
      const verification = await sendEmailVerificationForUser(
        user,
        "google-signin",
        { ignoreCooldown: true },
      );
      if (!verification.ok) {
        return res.status(verification.status).json({
          message: verification.message,
          resendAvailableAt: verification.resendAvailableAt,
        });
      }

      return res.status(200).json(verification.payload);
    }

    const accessToken = await createSession(user._id, res);
    emitAdminUserLifecycle(
      ADMIN_SOCKET_EVENTS.USER_LOGIN,
      user,
      "Người dùng đăng nhập",
      `${user.displayName} vừa đăng nhập`,
      "user:login",
    );
    return res.status(200).json(buildAuthResponse(user, accessToken));
  } catch (error) {
    logger.error("Lỗi googleCallback", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "Đăng nhập Google thất bại" });
  }
};

export const verifyEmailCode = async (req, res) => {
  try {
    const { verificationToken, code } = req.body || {};

    if (!verificationToken || !code) {
      return res
        .status(400)
        .json({ message: "Thiếu verificationToken hoặc mã xác minh." });
    }

    const tokenStatus = verifyPendingToken(verificationToken);
    if (!tokenStatus.ok) {
      return res
        .status(tokenStatus.status)
        .json({ message: tokenStatus.message });
    }

    const { decoded } = tokenStatus;
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    if (isUserBanned(user)) {
      return res.status(403).json(buildBannedResponse());
    }

    if (
      !user.emailVerificationCodeHash ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt < new Date()
    ) {
      return res.status(400).json({ message: "Mã xác minh đã hết hạn." });
    }

    const providedCodeHash = hashEmailCode(String(code).trim());
    if (providedCodeHash !== user.emailVerificationCodeHash) {
      return res.status(400).json({ message: "Mã xác minh không đúng." });
    }

    user.emailVerified = true;
    user.emailVerificationCodeHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    user.emailVerificationLastSentAt = undefined;
    await user.save();

    if (decoded.purpose === "signup") {
      return res.status(200).json({
        message: "Xác minh email thành công. Bây giờ bạn có thể đăng nhập.",
      });
    }

    // Check maintenance mode for signin flows - but allow admins to login
    if (!hasAdminPanelAccess(user)) {
      const maintenanceEnabled = await isMaintenanceEnabled();
      if (maintenanceEnabled) {
        const message = await getMaintenanceMessage();
        return res.status(503).json({
          code: "MAINTENANCE_MODE",
          message,
        });
      }
    }

    const accessToken = await createSession(user._id, res);
    emitAdminUserLifecycle(
      ADMIN_SOCKET_EVENTS.USER_LOGIN,
      user,
      "Người dùng đăng nhập",
      `${user.displayName} vừa đăng nhập`,
      "user:login",
    );
    return res.status(200).json(buildAuthResponse(user, accessToken));
  } catch (error) {
    logger.error("Lỗi verifyEmailCode", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "Xác minh email thất bại" });
  }
};

export const resendVerificationCode = async (req, res) => {
  try {
    const { verificationToken } = req.body || {};

    if (!verificationToken) {
      return res.status(400).json({ message: "Thiếu verificationToken." });
    }

    const tokenStatus = verifyPendingToken(verificationToken);
    if (!tokenStatus.ok) {
      return res
        .status(tokenStatus.status)
        .json({ message: tokenStatus.message });
    }

    const { decoded } = tokenStatus;
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email này đã được xác minh." });
    }

    const verification = await sendEmailVerificationForUser(user, decoded.purpose, {
      ignoreCooldown: false,
    });

    if (!verification.ok) {
      return res.status(verification.status).json({
        message: verification.message,
        resendAvailableAt: verification.resendAvailableAt,
      });
    }

    return res.status(200).json({
      ...verification.payload,
      message: "Đã gửi lại mã xác minh tới email của bạn.",
    });
  } catch (error) {
    logger.error("Lỗi resendVerificationCode", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "Không thể gửi lại mã xác minh" });
  }
};

export const signOut = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    let signedOutUser = null;

    if (req.headers.authorization?.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(
          req.headers.authorization.slice("Bearer ".length),
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

    emitAdminUserLifecycle(
      ADMIN_SOCKET_EVENTS.USER_LOGOUT,
      signedOutUser,
      "Nguoi dung dang xuat",
      signedOutUser
        ? `${signedOutUser.displayName} vua dang xuat`
        : "Mot nguoi dung vua dang xuat",
      "user:logout",
    );

    return res.sendStatus(204);
  } catch (error) {
    logger.error("Lỗi khi gọi signOut", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({
      message: "Lỗi hệ thống",
    });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ message: "Token không tồn tại." });
    }

    const session = await Session.findOne({ refreshToken: token });
    if (!session) {
      return res
        .status(403)
        .json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    }

    if (session.expiresAt < new Date()) {
      return res.status(403).json({ message: "Token đã hết hạn" });
    }

    const user = await User.findById(session.userId).select("status role");
    if (!user) {
      await Session.deleteOne({ _id: session._id });
      return res.status(404).json({ message: "Nguoi dung khong ton tai." });
    }

    if (isUserBanned(user)) {
      await Session.deleteMany({ userId: user._id });
      res.clearCookie("refreshToken");
      return res.status(403).json(buildBannedResponse());
    }

    // Check maintenance mode - but allow admins to refresh token
    if (!hasAdminPanelAccess(user)) {
      const maintenanceEnabled = await isMaintenanceEnabled();
      if (maintenanceEnabled) {
        const message = await getMaintenanceMessage();
        return res.status(503).json({
          code: "MAINTENANCE_MODE",
          message,
        });
      }
    }

    const accessToken = buildAccessToken(session.userId);
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 30 * 60 * 1000,
    });
    return res.status(200).json({ accessToken });
  } catch (error) {
    logger.error("Lỗi khi gọi refreshToken", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({
      message: "Lỗi hệ thống",
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "Thiếu currentPassword, newPassword hoặc confirmPassword",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "confirmPassword không khớp với newPassword",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const isCorrect = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!isCorrect) {
      return res.status(401).json({ message: "Mật khẩu hiện tại không đúng" });
    }

    const isSameAsOld = await bcrypt.compare(newPassword, user.hashedPassword);
    if (isSameAsOld) {
      return res.status(400).json({
        message: "Mật khẩu mới không được trùng mật khẩu cũ",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.hashedPassword = hashedPassword;
    await user.save();

    await Session.deleteMany({ userId: user._id });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return res.status(200).json({
      message: "Đổi mật khẩu thành công! Vui lòng đăng nhập lại.",
    });
  } catch (error) {
    logger.error("Lỗi khi gọi changePassword", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const requestAccountDeletion = async (req, res) => {
  try {
    const userId = req.user?._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    const deletion = await sendAccountDeletionCodeForUser(user, {
      ignoreCooldown: false,
    });

    if (!deletion.ok) {
      return res.status(deletion.status).json({
        message: deletion.message,
        resendAvailableAt: deletion.resendAvailableAt,
      });
    }

    return res.status(200).json(deletion.payload);
  } catch (error) {
    logger.error("Lỗi requestAccountDeletion", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({
      message: "Không thể bắt đầu yêu cầu xóa tài khoản.",
    });
  }
};

export const confirmAccountDeletion = async (req, res) => deleteMyAccount(req, res);
/*

  try {
    const userId = req.user?._id;
    const { code, confirmationText } = req.body || {};

    if (String(confirmationText || "").trim().toUpperCase() !== "DELETE") {
      return res.status(400).json({
        message: 'Vui lòng nhập đúng "DELETE" để xác nhận xóa tài khoản.',
      });
    }

    if (!code) {
      return res.status(400).json({ message: "Vui lòng nhập mã xác minh." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    if (!user.accountDeletionCodeHash || !user.accountDeletionExpiresAt) {
      return res.status(400).json({
        message: "Không tìm thấy yêu cầu xóa tài khoản đang hoạt động.",
      });
    }

    if (user.accountDeletionExpiresAt < new Date()) {
      await clearAccountDeletionState(user);
      return res.status(400).json({
        message:
          "Yêu cầu xóa tài khoản đã hết hạn sau 5 phút. Vui lòng tạo lại yêu cầu mới.",
      });
    }

    const providedCodeHash = hashEmailCode(String(code).trim());
    if (providedCodeHash !== user.accountDeletionCodeHash) {
      return res.status(400).json({ message: "Mã xác minh không đúng." });
    }

    const accountEmail = user.email;
    const displayName = user.displayName;

    await Session.deleteMany({ userId: user._id });
    await User.findByIdAndDelete(user._id);

    res.clearCookie("refreshToken");

    try {
      await sendAccountDeletedEmail({
        email: accountEmail,
        displayName,
      });
    } catch (mailError) {
      console.error("Lỗi sendAccountDeletedEmail", mailError);
    }

    return res.status(200).json({
      message: "Xóa tài khoản thành công.",
    });
  } catch (error) {
    console.error("Lỗi confirmAccountDeletion", error);
    return res.status(500).json({
      message: "Không thể xóa tài khoản. Vui lòng thử lại.",
    });
  }
};
*/
