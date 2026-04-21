import express from "express";
import {
  signUp,
  signIn,
  signOut,
  refreshToken,
  changePassword,
  requestAccountDeletion,
  confirmAccountDeletion,
  startGoogleAuth,
  googleCallback,
  verifyEmailCode,
  resendVerificationCode,
  forgotPassword,
  verifyForgotPasswordOtp,
  resetForgottenPassword,
} from "../controllers/authControllers.js";
import { protectedRoute } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/signup", signUp);

router.post("/signin", signIn);

router.get("/oauth2/google", startGoogleAuth);

router.post("/google/callback", googleCallback);

router.post("/verify-email", verifyEmailCode);

router.post("/resend-verification", resendVerificationCode);

router.post("/forgot-password", forgotPassword);

router.post("/verify-forgot-password-otp", verifyForgotPasswordOtp);

router.post("/reset-password", resetForgottenPassword);

router.post("/signout", signOut);

router.post("/refresh", refreshToken);

router.patch("/change-password", protectedRoute, changePassword);

router.post(
  "/delete-account/request",
  protectedRoute,
  requestAccountDeletion,
);

router.post(
  "/delete-account/confirm",
  protectedRoute,
  confirmAccountDeletion,
);

export default router;
