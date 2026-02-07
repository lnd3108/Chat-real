import express from "express";
import {
  createConversation,
  deleteOrLeaveGroupConversation,
  getConversation,
  getMessages,
  markasSeen,
} from "../controllers/conversationController.js";
import { checkFriendship } from "../middlewares/friendMiddleware.js";

const router = express.Router();

router.post("/", checkFriendship, createConversation);
router.get("/", getConversation);
router.get("/:conversationId/messages", getMessages);
router.patch("/:conversationId/seen", markasSeen);
router.delete("/:conversationId", deleteOrLeaveGroupConversation);

export default router;
