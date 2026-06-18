import crypto from "crypto";
import { buildKey } from "../../../shared/infrastructure/cache/cache.service.js";

export const hashRefreshToken = (token) => {
  if (!token || typeof token !== "string") {
    return null;
  }

  return crypto.createHash("sha256").update(token).digest("hex");
};

export const buildRefreshSessionKey = (tokenHash) => {
  if (!tokenHash) {
    return null;
  }

  return buildKey("session", "refresh", tokenHash);
};
