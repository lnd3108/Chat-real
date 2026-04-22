import crypto from "crypto";
import jwt from "jsonwebtoken";
import Session from "../../../models/Session.js";
import { sanitizeAuthResponse } from "../../../utils/sanitizeUser.js";

export const ACCESS_TOKEN_TTL = "30m";
export const REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60 * 1000;

export const buildAccessToken = (userId) =>
  jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });

export const createSession = async (userId, res) => {
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

export const buildAuthResponse = (user, accessToken) => ({
  message: `NgÆ°á»i dÃ¹ng ${user.displayName} Ä‘Ã£ Ä‘Äƒng nháº­p`,
  accessToken,
  user: sanitizeAuthResponse(user),
});
