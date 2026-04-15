import express from "express";

import {
  deleteMessageForEveryone,
  deleteMessageForMe,
  editMessage,
  sendDirectMessage,
  sendGroupMessage,
  sendMessageWithImage,
  toggleReaction,
} from "../controllers/messageController.js";
import { upload } from "../middlewares/uploadMiddleWare.js";
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
  upload.single("image"),
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
  upload.single("image"),
  checkGroupMemberShip,
  sendGroupMessage,
);
router.post(
  "/legacy/group/with-image",
  upload.single("image"),
  checkGroupMemberShip,
  sendMessageWithImage,
);
router.patch("/:messageId", editMessage);
router.delete("/:messageId/me", deleteMessageForMe);
router.delete("/:messageId/everyone", deleteMessageForEveryone);
router.post("/:messageId/reactions", toggleReaction);

export default router;
