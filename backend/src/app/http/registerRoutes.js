import express from "express";

import adminRoute from "../../routes/adminRoute.js";
import authRoute from "../../routes/authRoute.js";
import conversationRoute from "../../routes/conversationRoute.js";
import friendRoute from "../../routes/friendRoute.js";
import messageRoute from "../../routes/messageRoute.js";
import reportRoute from "../../routes/reportRoute.js";
import supportAdminRoute from "../../routes/supportAdminRoute.js";
import supportRoute from "../../routes/supportRoute.js";
import userRoute from "../../routes/userRoute.js";
import { protectedRoute } from "../../modules/identity/api/http/auth.middleware.js";

export const registerRoutes = (app) => {
  const router = express.Router();

  router.use("/auth", authRoute);
  router.use(protectedRoute);
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
