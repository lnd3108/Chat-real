import express from "express";

import adminRoute from "../../modules/admin-panel/api/http/admin.route.js";
import authRoute from "../../modules/auth/api/http/auth.route.js";
import conversationRoute from "../../modules/chat/api/http/conversation.route.js";
import messageRoute from "../../modules/chat/api/http/message.route.js";
import friendRoute from "../../modules/friendship/api/http/friend.route.js";
import reportRoute from "../../modules/moderation/api/http/report.route.js";
import supportAdminRoute from "../../modules/support/api/http/support-admin.route.js";
import supportRoute from "../../modules/support/api/http/support.route.js";
import userRoute from "../../modules/user-profile/api/http/user.route.js";

export const registerRoutes = (app) => {
  const router = express.Router();

  router.use("/auth", authRoute);
  router.use("/users", userRoute);
  router.use("/friends", friendRoute);
  router.use("/messages", messageRoute);
  router.use("/conversations", conversationRoute);
  router.use("/reports", reportRoute);
  router.use("/support", supportRoute);
  router.use("/admin/support", supportAdminRoute);
  router.use("/admin", adminRoute);

  app.use("/api", router);
};
