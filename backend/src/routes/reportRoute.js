import express from "express";
import { protectedRoute } from "../middlewares/authMiddleware.js";
import { createReport, getMyReports } from "../controllers/reportController.js";

const router = express.Router();

router.use(protectedRoute);

// Tạo báo cáo mới
router.post("/", createReport);

// Lấy danh sách báo cáo của người dùng hiện tại
router.get("/me", getMyReports);

export default router;
