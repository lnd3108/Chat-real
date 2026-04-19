import express from "express";

import { requireAdmin } from "../middlewares/authMiddleware.js";
import { permanentlyDeleteUserAccount } from "../services/accountDeletionService.js";

const router = express.Router();

router.delete("/users/:id", requireAdmin, async (req, res) => {
  try {
    const { summary } = await permanentlyDeleteUserAccount({
      targetUserId: req.params.id,
      actorUserId: req.user?._id ?? null,
      initiatedBy: "admin",
    });

    return res.status(200).json({
      success: true,
      message: "Tài khoản đã được xóa.",
      data: summary,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Không thể xóa tài khoản.",
    });
  }
});

export default router;
