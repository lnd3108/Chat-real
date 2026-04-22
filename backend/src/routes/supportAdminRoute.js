import express from "express";
import { requireAnyPermission, requirePermission, protectedRoute } from "../middlewares/authMiddleware.js";
import { APP_PERMISSIONS } from "../constants/rbac.js";
import {
  getSupportConversations,
  getSupportConversationDetail,
  sendSupportReply,
  updateSupportStatus,
  assignSupportAdmin,
} from "../modules/support/api/http/support-admin.controller.js";

const router = express.Router();

router.use(
  protectedRoute,
  requireAnyPermission([APP_PERMISSIONS.SUPPORT_VIEW, APP_PERMISSIONS.SUPPORT_REPLY]),
);

// Lấy danh sách cuộc trò chuyện hỗ trợ
router.get("/conversations", requirePermission(APP_PERMISSIONS.SUPPORT_VIEW), getSupportConversations);

// Lấy chi tiết cuộc trò chuyện hỗ trợ
router.get("/conversations/:id", requirePermission(APP_PERMISSIONS.SUPPORT_VIEW), getSupportConversationDetail);

// Gửi phản hồi hỗ trợ từ quản trị viên
router.post("/messages", requirePermission(APP_PERMISSIONS.SUPPORT_REPLY), sendSupportReply);

// Cập nhật trạng thái cuộc trò chuyện hỗ trợ
router.patch("/conversations/:id/status", requirePermission(APP_PERMISSIONS.SUPPORT_REPLY), updateSupportStatus);

// Gán quản trị viên phụ trách cuộc trò chuyện hỗ trợ
router.patch("/conversations/:id/assign", requirePermission(APP_PERMISSIONS.SUPPORT_REPLY), assignSupportAdmin);

export default router;
