import express from "express";
import { protectedRoute } from "../middlewares/authMiddleware.js";
import {
  getOrCreateSupportConversation,
  getCurrentSupportConversation,
  getUserSupportConversations,
  sendSupportMessage,
  getSupportConversationDetail,
  deleteSupportConversation,
} from "../controllers/supportController.js";

const router = express.Router();

router.use(protectedRoute);

// Get or create current open support conversation
router.post("/conversations", getOrCreateSupportConversation);
router.get("/conversations/me/current", getCurrentSupportConversation);

// Get all support conversations for the user
router.get("/conversations/me", getUserSupportConversations);

// Get support conversation detail with messages
router.get("/conversations/:id", getSupportConversationDetail);

// Delete support conversation for user (soft delete)
router.delete("/conversations/:id", deleteSupportConversation);

// Send support message
router.post("/messages", sendSupportMessage);

export default router;
