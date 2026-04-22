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

export default createRouteModule({
  routes: [
    defineRoute("post", "/signup", signUp),
    defineRoute("post", "/signin", signIn),
    defineRoute("get", "/oauth2/google", startGoogleAuth),
    defineRoute("post", "/google/callback", googleCallback),
    defineRoute("post", "/verify-email", verifyEmailCode),
    defineRoute("post", "/resend-verification", resendVerificationCode),
    defineRoute("post", "/forgot-password", forgotPassword),
    defineRoute("post", "/verify-forgot-password-otp", verifyForgotPasswordOtp),
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
