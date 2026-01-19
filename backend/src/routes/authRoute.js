import express from "express";
import {
  signUp,
  signIn,
  signOut,
  refreshToken,
  changePassword,
} from "../controllers/authControllers.js";
import { protectedRoute } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/signup", signUp);

router.post("/signin", signIn);

router.post("/signout", signOut);

router.post("/refresh", refreshToken);

router.patch("/change-password", protectedRoute, changePassword);

export default router;
