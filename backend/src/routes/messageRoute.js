import express from "express";

import {
  deleteMessageForEveryone,
  deleteMessageForMe,
  editMessage,
  toggleReaction,
} from "../controllers/messageController.js";
import {
  sendDirectMessage,
  sendGroupMessage,
  sendMessageWithImage,
} from "../modules/chat/api/http/message.controller.js";
import { handleSingleImageUpload, upload } from "../middlewares/uploadMiddleWare.js";
import {
  checkFriendship,
  checkGroupMemberShip,
} from "../middlewares/friendMiddleware.js";
import { validateRequest } from "../middlewares/validationMiddleware.js";
import {
  sendDirectMessageSchema,
  sendGroupMessageSchema,
} from "../libs/validation.js";

const router = express.Router();

router.post(
  "/direct",
  checkFriendship,
  validateRequest(sendDirectMessageSchema),
  sendDirectMessage,
);
router.post(
  "/direct/with-image",
  handleSingleImageUpload("image"),
  checkFriendship,
  sendDirectMessage,
);
router.post(
  "/group",
  checkGroupMemberShip,
  validateRequest(sendGroupMessageSchema),
  sendGroupMessage,
);
router.post(
  "/group/with-image",
  handleSingleImageUpload("image"),
  checkGroupMemberShip,
  sendGroupMessage,
);
router.post(
  "/legacy/group/with-image",
  handleSingleImageUpload("image"),
  checkGroupMemberShip,
  sendMessageWithImage,
);
router.patch("/:messageId", editMessage);
router.delete("/:messageId/me", deleteMessageForMe);
router.delete("/:messageId/everyone", deleteMessageForEveryone);
router.post("/:messageId/reactions", toggleReaction);

export default router;
