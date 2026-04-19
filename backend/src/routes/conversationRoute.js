import express from "express";
import {
  createConversation,
  deleteOrLeaveGroupConversation,
  getConversation,
  getMessages,
  markasSeen,
  addGroupMembers,
  removeGroupMember,
  getGroupDetails,
  uploadGroupAvatar,
  updateGroupName,
} from "../controllers/conversationController.js";
import { checkFriendship } from "../middlewares/friendMiddleware.js";
import { validateRequest } from "../middlewares/validationMiddleware.js";
import { upload } from "../middlewares/uploadMiddleWare.js";
import {
  createConversationSchema,
  addGroupMemberSchema,
  removeGroupMemberSchema,
} from "../libs/validation.js";

const router = express.Router();

router.post("/", checkFriendship, validateRequest(createConversationSchema), createConversation);
router.get("/", getConversation);
router.get("/:conversationId/messages", getMessages);
router.get("/:conversationId/details", getGroupDetails);
router.post("/:conversationId/avatar", upload.single("file"), uploadGroupAvatar);
router.patch("/:conversationId/name", updateGroupName);
router.patch("/:conversationId/seen", markasSeen);
router.patch(
  "/:conversationId/members/add",
  validateRequest(addGroupMemberSchema),
  addGroupMembers
);
router.patch(
  "/:conversationId/members/remove",
  validateRequest(removeGroupMemberSchema),
  removeGroupMember
);
router.delete("/:conversationId", deleteOrLeaveGroupConversation);

export default router;
