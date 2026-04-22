import express from "express";
import { protectedRoute } from "../middlewares/authMiddleware.js";
import {
  getOrCreateSupportConversation,
  getCurrentSupportConversation,
  getUserSupportConversations,
  sendSupportMessage,
  getSupportConversationDetail,
  deleteSupportConversation,
} from "../modules/support/api/http/support.controller.js";

const router = express.Router();

router.use(protectedRoute);

// Lấy hoặc tạo cuộc trò chuyện hỗ trợ đang mở hiện tại
router.post("/conversations", getOrCreateSupportConversation);
router.get("/conversations/me/current", getCurrentSupportConversation);

// Lấy toàn bộ cuộc trò chuyện hỗ trợ của người dùng
router.get("/conversations/me", getUserSupportConversations);

// Lấy chi tiết cuộc trò chuyện hỗ trợ kèm danh sách tin nhắn
router.get("/conversations/:id", getSupportConversationDetail);

// Xóa cuộc trò chuyện hỗ trợ phía người dùng
router.delete("/conversations/:id", deleteSupportConversation);

// Gửi tin nhắn hỗ trợ
router.post("/messages", sendSupportMessage);

export default router;
