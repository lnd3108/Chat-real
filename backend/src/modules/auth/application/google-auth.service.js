import bcrypt from "bcrypt";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import User from "../../../models/User.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

export const verifyGoogleIdToken = async (idToken) => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  return ticket.getPayload();
};

export const ensureGoogleEmailIsAllowed = (payload) => {
  if (!payload?.email) {
    return "TÃ i khoáº£n Google khÃ´ng tráº£ vá» email.";
  }

  if (!payload.email_verified) {
    return "Google chÆ°a xÃ¡c minh email nÃ y.";
  }

  if (!payload.email.toLowerCase().endsWith("@gmail.com")) {
    return "Chá»‰ Ä‘Æ°á»£c Ä‘Äƒng nháº­p báº±ng tÃ i khoáº£n Gmail.";
  }

  return null;
};

export const findOrCreateGoogleUser = async (payload) => {
  const googleId = payload.sub;
  const email = payload.email.toLowerCase();

  let user = await User.findOne({ $or: [{ googleId }, { email }] });

  if (user) {
    if (user.googleId && user.googleId !== googleId) {
      throw new Error("TÃ i khoáº£n nÃ y Ä‘Ã£ liÃªn káº¿t vá»›i Google khÃ¡c.");
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
