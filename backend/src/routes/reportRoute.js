import express from "express";
import { protectedRoute } from "../middlewares/authMiddleware.js";
import { createReport, getMyReports } from "../controllers/reportController.js";

const router = express.Router();

router.use(protectedRoute);

// Create a new report
router.post("/", createReport);

// Get user's own reports
router.get("/me", getMyReports);

export default router;
