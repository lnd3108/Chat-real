import express from "express";

import { requireAdmin, protectedRoute } from "../middlewares/authMiddleware.js";
import {
  deleteUserAsAdmin,
  getBlockedUsers,
  getConversations,
  getDashboardStats,
  getMessages,
  getPendingFriendRequests,
  getUserDetail,
  getUsers,
  updateUserRole,
  updateUserStatus,
} from "../controllers/adminController.js";

const router = express.Router();

router.use(protectedRoute, requireAdmin);

router.get("/dashboard", getDashboardStats);

router.get("/users", getUsers);
router.get("/users/:id", getUserDetail);
router.patch("/users/:id/status", updateUserStatus);
router.patch("/users/:userId/role", updateUserRole);
router.delete("/users/:id", deleteUserAsAdmin);

router.get("/friend-requests", getPendingFriendRequests);
router.get("/conversations", getConversations);
router.get("/messages", getMessages);
router.get("/blocked-users", getBlockedUsers);

export default router;
