import express from "express";
import {
  authMe,
  blockUser,
  getBlockedUsers,
  getUserSuggestions,
  searchUserByUserName,
  test,
  deleteMyAccount,
  unblockUser,
  updateMe,
  updatePreferences,
  uploadAvatar,
  sendEmailChangeOtp,
  verifyMyEmailChange,
  cancelMyEmailChange,
} from "../controllers/userController.js";
import { upload } from "../middlewares/uploadMiddleWare.js";

const router = express.Router();

router.get("/me", authMe);
router.patch("/me", updateMe);
router.patch("/me/profile", updateMe);
router.post("/me/email-change/send-otp", sendEmailChangeOtp);
router.post("/me/email-change/verify", verifyMyEmailChange);
router.post("/me/email-change/cancel", cancelMyEmailChange);
router.delete("/me", deleteMyAccount);

router.get("/test", test);

router.get("/search", searchUserByUserName);
router.get("/suggestions", getUserSuggestions);
router.get("/blocks", getBlockedUsers);
router.post("/blocks/:targetUserId", blockUser);
router.delete("/blocks/:targetUserId", unblockUser);

router.post("/uploadAvatar", upload.single("file"), uploadAvatar);

router.patch("/me/preferences", updatePreferences);

export default router;
