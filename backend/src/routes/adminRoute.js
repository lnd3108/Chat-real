import express from "express";

import { requireAdmin, protectedRoute } from "../middlewares/authMiddleware.js";
import { permanentlyDeleteUserAccount } from "../services/accountDeletionService.js";
import {
  getDashboardStats,
  getUsers,
  getUserDetail,
  updateUserRole,
  getPendingFriendRequests,
  getConversations,
  getMessages,
  getBlockedUsers,
} from "../controllers/adminController.js";

const router = express.Router();

// Tất cả admin routes cần qua middleware protectedRoute và requireAdmin
router.use(protectedRoute, requireAdmin);

// Dashboard Statistics
router.get("/dashboard", getDashboardStats);

// Users Management
router.get("/users", getUsers);
router.get("/users/:id", getUserDetail);
router.patch("/users/:userId/role", updateUserRole);

// Delete User (already existing)
router.delete("/users/:id", async (req, res) => {
  try {
    const { summary } = await permanentlyDeleteUserAccount({
      targetUserId: req.params.id,
      actorUserId: req.user?._id ?? null,
      initiatedBy: "admin",
    });

    return res.status(200).json({
      success: true,
      message: "Tài khoản đã được xóa.",
      data: summary,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Không thể xóa tài khoản.",
    });
  }
});

// Friend Requests Management
router.get("/friend-requests", getPendingFriendRequests);

// Conversations Management
router.get("/conversations", getConversations);

// Messages Management
router.get("/messages", getMessages);

// Blocked Users Management
router.get("/blocked-users", getBlockedUsers);

export default router;
