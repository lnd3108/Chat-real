import express from "express";

import {
  sendDirectMessage,
  sendGroupMessage,
  sendMessageWithImage,
} from "../controllers/messageController.js";
import { upload } from "../middlewares/uploadMiddleWare.js";
import {
  checkFriendship,
  checkGroupMemberShip,
} from "../middlewares/friendMiddleware.js";
import { validateRequest } from "../middlewares/validationMiddleware.js";
import { sendDirectMessageSchema, sendGroupMessageSchema } from "../libs/validation.js";

const router = express.Router();

router.post("/direct", checkFriendship, validateRequest(sendDirectMessageSchema), sendDirectMessage);
router.post("/group", checkGroupMemberShip, validateRequest(sendGroupMessageSchema), sendGroupMessage);
router.post(
  "/group/with-image",
  checkGroupMemberShip,
  upload.single("image"),
  sendMessageWithImage
);
export default router;
