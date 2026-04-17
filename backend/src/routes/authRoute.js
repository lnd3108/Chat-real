import express from "express";
import {
  signUp,
  signIn,
  signOut,
  refreshToken,
  changePassword,
  deleteAccount,
  startGoogleAuth,
  googleCallback,
  verifyGoogleEmailCode,
} from "../controllers/authControllers.js";
import { protectedRoute } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/signup", signUp);

router.post("/signin", signIn);

router.get("/oauth2/google", startGoogleAuth);

router.post("/google/callback", googleCallback);

router.post("/google/verify-email", verifyGoogleEmailCode);

router.post("/signout", signOut);

router.post("/refresh", refreshToken);

router.patch("/change-password", protectedRoute, changePassword);

router.delete("/delete-account", protectedRoute, deleteAccount);

export default router;
