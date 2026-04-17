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
} from "../utils/mail.js";

const ACCESS_TOKEN_TTL = "30m";
const REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60 * 1000;
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_TOKEN_TTL = "10m";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const buildAccessToken = (userId) =>
  jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });

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

  return accessToken;
};

const buildAuthResponse = (user, accessToken) => ({
  message: `Người dùng ${user.displayName} đã đăng nhập`,
  accessToken,
  user: {
    id: user._id,
    userName: user.userName,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    authProvider: user.authProvider,
    emailVerified: user.emailVerified,
  },
});

const createPendingVerificationToken = (user) =>
  jwt.sign(
    {
      userId: user._id,
      email: user.email,
      type: "google-email-verification",
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: EMAIL_TOKEN_TTL },
  );

const generateEmailCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

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

const persistVerificationCode = async (user) => {
  const code = generateEmailCode();

  user.emailVerificationCodeHash = hashEmailCode(code);
  user.emailVerificationExpiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);
  await user.save();

  return code;
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
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
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

  let user = await User.findOne({
    $or: [{ googleId }, { email }],
  });

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

  user = await User.create({
    userName,
    hashedPassword,
    email,
    displayName: payload.name || userName,
    avatarUrl: payload.picture,
    authProvider: "google",
    googleId,
    emailVerified: false,
  });

  return user;
};

export const signUp = async (req, res) => {
  try {
    const validatedData = signUpSchema.parse(req.body);
    const { userName, password, email, firstName, lastName } = validatedData;

    const duplicate = await User.findOne({ userName: userName.toLowerCase() });
    if (duplicate) {
      return res.status(409).json({ message: "userName đã tồn tại" });
    }

    const duplicateEmail = await User.findOne({ email: email.toLowerCase() });
    if (duplicateEmail) {
      return res.status(409).json({ message: "Email đã tồn tại" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      userName: userName.toLowerCase(),
      hashedPassword,
      email: email.toLowerCase(),
      displayName: `${lastName} ${firstName}`,
      authProvider: "local",
      emailVerified: true,
    });

    return res.status(201).json({ message: "Người dùng đã được tạo thành công" });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Lỗi xác thực dữ liệu",
        errors: error.errors,
      });
    }
    console.error("Lỗi khi gọi signUp", error);
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
        .json({ message: "userName hoặc Password không chính xác" });
    }

    const passwordCorrect = await bcrypt.compare(password, user.hashedPassword);
    if (!passwordCorrect) {
      return res
        .status(401)
        .json({ message: "userName hoặc Password không chính xác" });
    }

    const accessToken = await createSession(user._id, res);

    return res.status(200).json(buildAuthResponse(user, accessToken));
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Lỗi xác thực dữ liệu",
        errors: error.issues,
      });
    }

    console.error("Lỗi signIn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
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
    console.error("Lỗi startGoogleAuth", error);
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

    if (!user.emailVerified) {
      if (!isMailConfigured()) {
        return res.status(500).json({
          message:
            "Đăng nhập Google đã xác thực thành công, nhưng hệ thống chưa cấu hình SMTP để gửi mã xác minh.",
        });
      }

      const codeValue = await persistVerificationCode(user);
      await sendVerificationCodeEmail({
        email: user.email,
        code: codeValue,
        displayName: user.displayName,
      });

      return res.status(200).json({
        requiresEmailVerification: true,
        verificationToken: createPendingVerificationToken(user),
        email: user.email,
        message: "Đã gửi mã xác minh tới Gmail của bạn.",
      });
    }

    const accessToken = await createSession(user._id, res);
    return res.status(200).json(buildAuthResponse(user, accessToken));
  } catch (error) {
    console.error("Lỗi googleCallback", error);
    return res.status(500).json({ message: "Đăng nhập Google thất bại" });
  }
};

export const verifyGoogleEmailCode = async (req, res) => {
  try {
    const { verificationToken, code } = req.body || {};

    if (!verificationToken || !code) {
      return res
        .status(400)
        .json({ message: "Thiếu verificationToken hoặc mã xác minh." });
    }

    let decoded;
    try {
      decoded = jwt.verify(verificationToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      return res.status(401).json({ message: "Verification token không hợp lệ." });
    }

    if (decoded.type !== "google-email-verification") {
      return res.status(401).json({ message: "Sai loại verification token." });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
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
    await user.save();

    const accessToken = await createSession(user._id, res);
    return res.status(200).json(buildAuthResponse(user, accessToken));
  } catch (error) {
    console.error("Lỗi verifyGoogleEmailCode", error);
    return res.status(500).json({ message: "Xác minh email thất bại" });
  }
};

export const signOut = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;

    if (token) {
      await Session.deleteOne({ refreshToken: token });
      res.clearCookie("refreshToken");
    }

    return res.sendStatus(204);
  } catch (error) {
    console.error("Lỗi khi gọi signOut", error);
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

    const accessToken = buildAccessToken(session.userId);
    return res.status(200).json({ accessToken });
  } catch (error) {
    console.error("Lỗi khi gọi refreshToken", error);
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
    console.error("Lỗi khi gọi changePassword", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const deleteAccount = async (req, res) => {
  const userId = req.user._id;

  await User.findByIdAndDelete(userId);

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  return res.status(200).json({
    message: "Xóa tài khoản thành công!",
  });
};
