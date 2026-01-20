import express from "express";
import {
  authMe,
  searchUserByUserName,
  test,
  updateMe,
  updatePreferences,
  uploadAvatar,
} from "../controllers/userController.js";
import { upload } from "../middlewares/uploadMiddleWare.js";

const router = express.Router();

router.get("/me", authMe);
router.patch("/me", updateMe);

router.get("/test", test);

router.get("/search", searchUserByUserName);

router.post("/uploadAvatar", upload.single("file"), uploadAvatar);

router.patch("/me/preferences", updatePreferences);

export default router;
