import express from "express";

import { requireAdmin, protectedRoute } from "../middlewares/authMiddleware.js";
import {
  deleteUserAsAdmin,
  getBlockDetail,
  getBlocks,
  getDashboardOverview,
  getDashboardMessageChart,
  getDashboardReportChart,
  getBlockedUsers,
  getConversationDetail,
  getConversations,
  getDashboardStats,
  getDashboardSupportChart,
  getDashboardUserChart,
  getFriendships,
  getFriendRequestsAdmin,
  getMessages,
  getUserDetail,
  getUsers,
  unblockBlockRelationAsAdmin,
  updateUserRole,
  updateUserStatus,
  getReports,
  getReportDetail,
  updateReportStatus,
  resolveReportWithAction,
} from "../controllers/adminController.js";

const router = express.Router();

router.use(protectedRoute, requireAdmin);

router.get("/dashboard/overview", getDashboardOverview);
router.get("/dashboard/charts/users", getDashboardUserChart);
router.get("/dashboard/charts/messages", getDashboardMessageChart);
router.get("/dashboard/charts/reports", getDashboardReportChart);
router.get("/dashboard/charts/support", getDashboardSupportChart);
router.get("/dashboard", getDashboardStats);

router.get("/users", getUsers);
router.get("/users/:id", getUserDetail);
router.patch("/users/:id/status", updateUserStatus);
router.patch("/users/:userId/role", updateUserRole);
router.delete("/users/:id", deleteUserAsAdmin);

router.get("/friends", getFriendships);
router.get("/friend-requests", getFriendRequestsAdmin);
router.get("/conversations", getConversations);
router.get("/conversations/:id", getConversationDetail);
router.get("/messages", getMessages);
router.get("/blocks", getBlocks);
router.get("/blocks/:id", getBlockDetail);
router.patch("/blocks/:id/unblock", unblockBlockRelationAsAdmin);
router.get("/blocked-users", getBlockedUsers);

// Reports
router.get("/reports", getReports);
router.get("/reports/:id", getReportDetail);
router.patch("/reports/:id/status", updateReportStatus);
router.patch("/reports/:id/resolve-with-action", resolveReportWithAction);

export default router;
