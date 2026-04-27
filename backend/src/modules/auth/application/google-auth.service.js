import bcrypt from "bcrypt";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import User from "../../../models/User.js";

// Cấu hình OAuth2Client với client ID của bạn từ Google Cloud Console
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Hàm tạo userName duy nhất dựa trên email
export const createUniqueUserName = async (email) => {
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

// Hàm tạo URL đăng nhập Google
export const getGoogleAuthUrl = () => {
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

// Hàm trao đổi mã code lấy access token và ID token từ Google
export const exchangeGoogleCodeForTokens = async (code) => {
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

// Hàm xác minh ID token và lấy thông tin người dùng từ Google
export const verifyGoogleIdToken = async (idToken) => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  return ticket.getPayload();
};

// Hàm kiểm tra tính hợp lệ của email Google và các điều kiện liên quan
export const ensureGoogleEmailIsAllowed = (payload) => {
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

// Hàm tìm kiếm hoặc tạo người dùng dựa trên thông tin từ Google
export const findOrCreateGoogleUser = async (payload) => {
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
