import express from "express";

import { requireAdmin, protectedRoute } from "../middlewares/authMiddleware.js";
import {
  deleteUserAsAdmin,
  getBlockDetail,
  getBlocks,
  getBlockedUsers,
  getConversations,
  getDashboardStats,
  getFriendships,
  getMessages,
  getPendingFriendRequests,
  getUserDetail,
  getUsers,
  unblockBlockRelationAsAdmin,
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

router.get("/friends", getFriendships);
router.get("/friend-requests", getPendingFriendRequests);
router.get("/conversations", getConversations);
router.get("/messages", getMessages);
router.get("/blocks", getBlocks);
router.get("/blocks/:id", getBlockDetail);
router.patch("/blocks/:id/unblock", unblockBlockRelationAsAdmin);
router.get("/blocked-users", getBlockedUsers);

export default router;
