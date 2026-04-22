import {
  authMe,
  blockUser,
  cancelMyEmailChange,
  deleteMyAccount,
  getBlockedUsers,
  getUserSuggestions,
  searchUserByUserName,
  sendEmailChangeOtp,
  test,
  unblockUser,
  updateMe,
  updatePreferences,
  uploadAvatar,
  verifyMyEmailChange,
} from "./user.controller.js";
import { protectedRoute } from "../../../identity/api/http/auth.middleware.js";
import { createRouteModule, defineRoute } from "../../../../shared/api/http/route-adapter.js";
import { uploadSingleFile } from "../../../../shared/api/http/request-middleware-adapters.js";

export default createRouteModule({
  routerMiddlewares: [protectedRoute],
  routes: [
    defineRoute("get", "/me", authMe),
    defineRoute("patch", "/me", updateMe),
    defineRoute("patch", "/me/profile", updateMe),
    defineRoute("post", "/me/email-change/send-otp", sendEmailChangeOtp),
    defineRoute("post", "/me/email-change/verify", verifyMyEmailChange),
    defineRoute("post", "/me/email-change/cancel", cancelMyEmailChange),
    defineRoute("delete", "/me", deleteMyAccount),
    defineRoute("get", "/test", test),
    defineRoute("get", "/search", searchUserByUserName),
    defineRoute("get", "/suggestions", getUserSuggestions),
    defineRoute("get", "/blocks", getBlockedUsers),
    defineRoute("post", "/blocks/:targetUserId", blockUser),
    defineRoute("delete", "/blocks/:targetUserId", unblockUser),
    defineRoute("post", "/uploadAvatar", uploadSingleFile("file"), uploadAvatar),
    defineRoute("patch", "/me/preferences", updatePreferences),
  ],
});
