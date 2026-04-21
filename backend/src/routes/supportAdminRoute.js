import express from "express";
import { requireAdmin, protectedRoute } from "../middlewares/authMiddleware.js";
import {
  getSupportConversations,
  getSupportConversationDetail,
  sendSupportReply,
  updateSupportStatus,
  assignSupportAdmin,
} from "../controllers/supportAdminController.js";

const router = express.Router();

router.use(protectedRoute, requireAdmin);

// Lấy danh sách cuộc trò chuyện hỗ trợ
router.get("/conversations", getSupportConversations);

// Lấy chi tiết cuộc trò chuyện hỗ trợ
router.get("/conversations/:id", getSupportConversationDetail);

// Gửi phản hồi hỗ trợ từ quản trị viên
router.post("/messages", sendSupportReply);

// Cập nhật trạng thái cuộc trò chuyện hỗ trợ
router.patch("/conversations/:id/status", updateSupportStatus);

// Gán quản trị viên phụ trách cuộc trò chuyện hỗ trợ
router.patch("/conversations/:id/assign", assignSupportAdmin);

export default router;
