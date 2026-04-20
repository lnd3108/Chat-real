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

// Get list of support conversations
router.get("/conversations", getSupportConversations);

// Get support conversation detail
router.get("/conversations/:id", getSupportConversationDetail);

// Send admin reply to support
router.post("/messages", sendSupportReply);

// Update support conversation status
router.patch("/conversations/:id/status", updateSupportStatus);

// Assign admin to support conversation
router.patch("/conversations/:id/assign", assignSupportAdmin);

export default router;
