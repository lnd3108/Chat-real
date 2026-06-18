import {
  changePassword,
  confirmAccountDeletion,
  forgotPassword,
  googleCallback,
  refreshToken,
  requestAccountDeletion,
  resendVerificationCode,
  resetForgottenPassword,
  signIn,
  signOut,
  signUp,
  startGoogleAuth,
  verifyEmailCode,
  verifyForgotPasswordOtp,
} from "./auth.controller.js";
import { protectedRoute } from "../../../identity/api/http/auth.middleware.js";
import { createRouteModule, defineRoute } from "../../../../shared/api/http/route-adapter.js";
import {
  rateLimitAuthForgotPassword,
  rateLimitAuthResendVerification,
  rateLimitAuthSignin,
  rateLimitAuthSignup,
  rateLimitAuthVerifyForgotPasswordOtp,
} from "../../../../middlewares/redisRateLimit.js";
import { signinPipelineTimingMiddleware } from "../../../../shared/infrastructure/perf/signin-pipeline-timing.js";

// Xử lý các route
export default createRouteModule({
  routes: [
    defineRoute("post", "/signup", rateLimitAuthSignup, signUp),
    defineRoute(
      "post",
      "/signin",
      signinPipelineTimingMiddleware,
      rateLimitAuthSignin,
      signIn,
    ),
    defineRoute("get", "/oauth2/google", startGoogleAuth),
    defineRoute("post", "/google/callback", googleCallback),
    defineRoute("post", "/verify-email", verifyEmailCode),
    defineRoute(
      "post",
      "/resend-verification",
      rateLimitAuthResendVerification,
      resendVerificationCode,
    ),
    defineRoute(
      "post",
      "/forgot-password",
      rateLimitAuthForgotPassword,
      forgotPassword,
    ),
    defineRoute(
      "post",
      "/verify-forgot-password-otp",
      rateLimitAuthVerifyForgotPasswordOtp,
      verifyForgotPasswordOtp,
    ),
    defineRoute("post", "/reset-password", resetForgottenPassword),
    defineRoute("post", "/signout", signOut),
    defineRoute("post", "/refresh", refreshToken),
    defineRoute("patch", "/change-password", protectedRoute, changePassword),
    defineRoute(
      "post",
      "/delete-account/request",
      protectedRoute,
      requestAccountDeletion,
    ),
    defineRoute(
      "post",
      "/delete-account/confirm",
      protectedRoute,
      confirmAccountDeletion,
    ),
  ],
});
