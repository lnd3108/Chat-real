import express from "express";
import {
  authMe,
  searchUserByUserName,
  test,
  uploadAvatar,
} from "../controllers/userController.js";
import { upload } from "../middlewares/uploadMiddleWare.js";

const router = express.Router();

router.get("/me", authMe);

router.get("/test", test);

router.get("/search", searchUserByUserName);

router.post("/uploadAvatar", upload.single("file"), uploadAvatar);

export default router;
