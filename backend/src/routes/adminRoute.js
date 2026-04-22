import express from "express";

import {
  requireAdmin,
  requireAnyPermission,
  requirePermission,
  protectedRoute,
} from "../middlewares/authMiddleware.js";
import { APP_PERMISSIONS } from "../constants/rbac.js";
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
  getMaintenanceInfo,
  getSystemHealth,
  requestMaintenancePasswordVerification,
  verifyMaintenancePassword,
  confirmMaintenanceToggle,
  updateMaintenanceMessage,
} from "../modules/admin-panel/api/http/admin.controller.js";
import {
  getAdminAuditLogs,
  getAdminRoles,
  getAdminUserPermissions,
  patchAdminUserRoles,
} from "../modules/admin-panel/api/http/admin-role.controller.js";

const router = express.Router();

router.use(protectedRoute, requireAdmin);

router.get("/dashboard/overview", requirePermission(APP_PERMISSIONS.DASHBOARD_VIEW), getDashboardOverview);
router.get("/dashboard/charts/users", requirePermission(APP_PERMISSIONS.DASHBOARD_VIEW), getDashboardUserChart);
router.get("/dashboard/charts/messages", requirePermission(APP_PERMISSIONS.DASHBOARD_VIEW), getDashboardMessageChart);
router.get("/dashboard/charts/reports", requirePermission(APP_PERMISSIONS.DASHBOARD_VIEW), getDashboardReportChart);
router.get("/dashboard/charts/support", requirePermission(APP_PERMISSIONS.DASHBOARD_VIEW), getDashboardSupportChart);
router.get("/dashboard", requirePermission(APP_PERMISSIONS.DASHBOARD_VIEW), getDashboardStats);

router.get("/roles", requirePermission(APP_PERMISSIONS.ROLE_VIEW), getAdminRoles);
router.get("/audit-logs", requirePermission(APP_PERMISSIONS.AUDIT_LOG_VIEW), getAdminAuditLogs);
router.get("/users", requirePermission(APP_PERMISSIONS.USER_VIEW), getUsers);
router.get("/users/:id/permissions", requirePermission(APP_PERMISSIONS.PERMISSION_VIEW), getAdminUserPermissions);
router.get("/users/:id", requirePermission(APP_PERMISSIONS.USER_VIEW), getUserDetail);
router.patch("/users/:id/status", requireAnyPermission([APP_PERMISSIONS.USER_LOCK, APP_PERMISSIONS.USER_UNLOCK]), updateUserStatus);
router.patch("/users/:id/roles", requirePermission(APP_PERMISSIONS.ROLE_ASSIGN), patchAdminUserRoles);
router.patch("/users/:userId/role", requirePermission(APP_PERMISSIONS.ROLE_ASSIGN), patchAdminUserRoles);
router.delete("/users/:id", requirePermission(APP_PERMISSIONS.USER_DELETE), deleteUserAsAdmin);

router.get("/friends", requirePermission(APP_PERMISSIONS.USER_VIEW), getFriendships);
router.get("/friend-requests", requirePermission(APP_PERMISSIONS.USER_VIEW), getFriendRequestsAdmin);
router.get("/conversations", requirePermission(APP_PERMISSIONS.USER_VIEW), getConversations);
router.get("/conversations/:id", requirePermission(APP_PERMISSIONS.USER_VIEW), getConversationDetail);
router.get("/messages", requirePermission(APP_PERMISSIONS.USER_VIEW), getMessages);
router.get("/blocks", requirePermission(APP_PERMISSIONS.USER_VIEW), getBlocks);
router.get("/blocks/:id", requirePermission(APP_PERMISSIONS.USER_VIEW), getBlockDetail);
router.patch("/blocks/:id/unblock", requireAnyPermission([APP_PERMISSIONS.USER_UNLOCK, APP_PERMISSIONS.USER_LOCK]), unblockBlockRelationAsAdmin);
router.get("/blocked-users", requirePermission(APP_PERMISSIONS.USER_VIEW), getBlockedUsers);

// Reports
router.get("/reports", requirePermission(APP_PERMISSIONS.REPORT_VIEW), getReports);
router.get("/reports/:id", requirePermission(APP_PERMISSIONS.REPORT_VIEW), getReportDetail);
router.patch("/reports/:id/status", requirePermission(APP_PERMISSIONS.REPORT_HANDLE), updateReportStatus);
router.patch("/reports/:id/resolve-with-action", requirePermission(APP_PERMISSIONS.REPORT_HANDLE), resolveReportWithAction);

// System Health
router.get("/health", getSystemHealth);

// Maintenance Mode
router.get("/maintenance/status", requirePermission(APP_PERMISSIONS.MAINTENANCE_TOGGLE), getMaintenanceInfo);
router.post("/maintenance/request-verification", requirePermission(APP_PERMISSIONS.MAINTENANCE_TOGGLE), requestMaintenancePasswordVerification);
router.post("/maintenance/verify-password", requirePermission(APP_PERMISSIONS.MAINTENANCE_TOGGLE), verifyMaintenancePassword);
router.post("/maintenance/confirm-toggle", requirePermission(APP_PERMISSIONS.MAINTENANCE_TOGGLE), confirmMaintenanceToggle);
router.patch("/maintenance/message", requirePermission(APP_PERMISSIONS.MAINTENANCE_TOGGLE), updateMaintenanceMessage);

export default router;
