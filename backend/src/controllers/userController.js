import {
  deleteImageFromCloudinary,
  uploadImageFromBuffer,
} from "../middlewares/uploadMiddleWare.js";
import Blocking, { BLOCKING_TYPE_DIRECT_ONLY } from "../models/Blocking.js";
import User from "../models/User.js";
import { permanentlyDeleteUserAccount } from "../services/accountDeletionService.js";
import {
  getUserSuggestionsForViewer,
  searchDiscoverableUsersForViewer,
} from "../services/userDiscoveryService.js";
import { serializeUserAccess } from "../services/rbacService.js";
import { emitDirectBlockStatusChanged } from "./conversationController.js";
import { sanitizeUser } from "../utils/sanitizeUser.js";
import { logger } from "../utils/logger.js";
import {
  cancelEmailChangeVerification,
  resendEmailChangeOtp,
  updateMyProfile,
  verifyEmailChangeOtp,
} from "../services/emailChangeService.js";

const formatBlockedUsers = async (blockedUsers = []) => {
  const targetIds = blockedUsers
    .map((entry) => entry.userId?.toString())
    .filter(Boolean);

  if (targetIds.length === 0) {
    return [];
  }

  const users = await User.find({
    _id: { $in: targetIds },
  }).select("userName displayName avatarUrl");

  const usersById = new Map(users.map((user) => [user._id.toString(), user]));

  return blockedUsers
    .map((entry) => {
      const targetUser = usersById.get(entry.userId?.toString());
      if (!targetUser) return null;

      return {
        _id: targetUser._id,
        userName: targetUser.userName,
        displayName: targetUser.displayName,
        avatarUrl: targetUser.avatarUrl ?? null,
        reason: entry.reason ?? null,
        createdAt: entry.createdAt,
      };
    })
    .filter(Boolean);
};

const normalizeString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
};

export const authMe = async (req, res) => {
  try {
    const user = sanitizeUser(serializeUserAccess(req.user));

    return res.status(200).json({ user });
  } catch (error) {
    logger.error("Lỗi khi gọi authMe", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const test = async (req, res) => res.sendStatus(204);

export const searchUserByUserName = async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 20)
      : 10;

    if (!q) {
      return res.status(400).json({ message: "Can cung cap tu khoa tim kiem." });
    }

    const usersWithMeta = await searchDiscoverableUsersForViewer(req.user._id, q, limit);

    return res.status(200).json({ users: usersWithMeta });
  } catch (error) {
    console.error("Loi xay ra khi searchUserByUserName", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const getUserSuggestions = async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 5)
      : 5;

    const users = await getUserSuggestionsForViewer(req.user._id, limit);

    return res.status(200).json({ users });
  } catch (error) {
    console.error("Loi khi lay user suggestions", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    const file = req.file;
    const userId = req.user._id;

    if (!file) {
      return res.status(400).json({ message: "Khong co file duoc tai len" });
    }

    const currentUser = await User.findById(userId).select("avatarId");
    const result = await uploadImageFromBuffer(file.buffer);

    if (currentUser?.avatarId) {
      await deleteImageFromCloudinary(currentUser.avatarId).catch((error) => {
        console.error("Khong the xoa avatar cu tren Cloudinary:", error);
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        avatarUrl: result.secure_url,
        avatarId: result.public_id,
      },
      {
        new: true,
      },
    ).select("avatarUrl");

    if (!updatedUser.avatarUrl) {
      return res.status(400).json({ message: "Avatar tra ve null" });
    }

    return res.status(200).json({ avatarUrl: updatedUser.avatarUrl });
  } catch (error) {
    console.error("Loi khi upload avatar:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const updateMe = async (req, res) => {
  try {
    const payload = await updateMyProfile({
      userId: req.user?._id,
      payload: req.body || {},
      req,
    });

    return res.status(200).json(payload);
  } catch (error) {
    logger.warn("Loi updateMe", {
      message: error?.message,
      status: error?.status,
    });
    return res.status(error?.status || 500).json({
      success: false,
      message: error?.message || "Loi he thong",
      resendAfter: error?.resendAfter,
    });
  }
};

export const sendEmailChangeOtp = async (req, res) => {
  try {
    const payload = await resendEmailChangeOtp({
      userId: req.user?._id,
      newEmail: req.body?.newEmail,
      req,
    });

    return res.status(200).json(payload);
  } catch (error) {
    logger.warn("Loi sendEmailChangeOtp", {
      message: error?.message,
      status: error?.status,
    });
    return res.status(error?.status || 500).json({
      success: false,
      message: error?.message || "Khong the gui ma xac minh email moi.",
      resendAfter: error?.resendAfter,
    });
  }
};

export const verifyMyEmailChange = async (req, res) => {
  try {
    const payload = await verifyEmailChangeOtp({
      userId: req.user?._id,
      newEmail: req.body?.newEmail,
      otp: req.body?.otp,
    });

    return res.status(200).json(payload);
  } catch (error) {
    logger.warn("Loi verifyMyEmailChange", {
      message: error?.message,
      status: error?.status,
    });
    return res.status(error?.status || 500).json({
      success: false,
      message: error?.message || "Khong the xac minh email moi.",
    });
  }
};

export const cancelMyEmailChange = async (req, res) => {
  try {
    const payload = await cancelEmailChangeVerification({
      userId: req.user?._id,
      newEmail: req.body?.newEmail ?? null,
    });

    return res.status(200).json(payload);
  } catch (error) {
    logger.warn("Loi cancelMyEmailChange", {
      message: error?.message,
      status: error?.status,
    });
    return res.status(error?.status || 500).json({
      success: false,
      message: error?.message || "Khong the huy xac minh email moi.",
    });
  }
};

export const updatePreferences = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { theme, showOnlineStatus } = req.body || {};

    const updates = {};

    if (theme) updates["preferences.theme"] = theme;

    if (typeof showOnlineStatus === "boolean") {
      updates["preferences.showOnlineStatus"] = showOnlineStatus;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true },
    ).select("-hashedPassword");

    return res.status(200).json({
      message: "Cap nhat cau hinh thanh cong!",
      user: serializeUserAccess(updatedUser?.toObject?.() || updatedUser),
    });
  } catch (error) {
    console.error("Loi updatePreferences:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user?._id).select("blockedUsers");

    return res.status(200).json({
      blockedUsers: await formatBlockedUsers(user?.blockedUsers ?? []),
    });
  } catch (error) {
    console.error("Loi getBlockedUsers:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const blockUser = async (req, res) => {
  try {
    const actorId = req.user?._id;
    const { targetUserId } = req.params;
    const { reason } = req.body || {};

    if (!targetUserId) {
      return res.status(400).json({ message: "Thieu nguoi dung can chan" });
    }

    if (actorId.toString() === targetUserId.toString()) {
      return res.status(400).json({ message: "Ban khong the tu chan chinh minh" });
    }

    const targetUser = await User.findById(targetUserId).select("_id");
    if (!targetUser) {
      return res.status(404).json({ message: "Nguoi dung khong ton tai" });
    }

    const blockedAt = new Date();

    await User.findByIdAndUpdate(actorId, {
      $pull: { blockedUsers: { userId: targetUserId } },
    });

    const [updatedUser] = await Promise.all([
      User.findByIdAndUpdate(
        actorId,
        {
          $push: {
            blockedUsers: {
              userId: targetUserId,
              reason: reason?.trim() || null,
              createdAt: blockedAt,
            },
          },
        },
        { new: true },
      ).select("blockedUsers"),
      Blocking.findOneAndUpdate(
        {
          userId: actorId,
          blockedUserId: targetUserId,
        },
        {
          $set: {
            reason: reason?.trim() || null,
            isActive: true,
            unblockedAt: null,
            type: BLOCKING_TYPE_DIRECT_ONLY,
            createdAt: blockedAt,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      ),
    ]);

    await emitDirectBlockStatusChanged({
      actorUser: req.user,
      targetUserId,
      isBlocked: true,
    });

    return res.status(200).json({
      message: "Da chan nguoi dung",
      blockedUsers: await formatBlockedUsers(updatedUser?.blockedUsers ?? []),
    });
  } catch (error) {
    console.error("Loi blockUser:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const actorId = req.user?._id;
    const { targetUserId } = req.params;

    if (!targetUserId) {
      return res.status(400).json({ message: "Thieu nguoi dung can bo chan" });
    }

    const unblockedAt = new Date();

    const [updatedUser] = await Promise.all([
      User.findByIdAndUpdate(
        actorId,
        {
          $pull: { blockedUsers: { userId: targetUserId } },
        },
        { new: true },
      ).select("blockedUsers"),
      Blocking.findOneAndUpdate(
        {
          userId: actorId,
          blockedUserId: targetUserId,
        },
        {
          $set: {
            isActive: false,
            unblockedAt,
            type: BLOCKING_TYPE_DIRECT_ONLY,
          },
        },
        {
          new: true,
        },
      ),
    ]);

    await emitDirectBlockStatusChanged({
      actorUser: req.user,
      targetUserId,
      isBlocked: false,
    });

    return res.status(200).json({
      message: "Da bo chan nguoi dung",
      blockedUsers: await formatBlockedUsers(updatedUser?.blockedUsers ?? []),
    });
  } catch (error) {
    console.error("Loi unblockUser:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const deleteMyAccount = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { code, confirmationText } = req.body || {};

    if (String(confirmationText || "").trim().toUpperCase() !== "DELETE") {
      return res.status(400).json({
        message: 'Vui lòng nhập đúng "DELETE" để xác nhận xóa tài khoản.',
      });
    }

    if (!code) {
      return res.status(400).json({ message: "Vui lòng nhập mã xác minh." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    if (!user.accountDeletionCodeHash || !user.accountDeletionExpiresAt) {
      return res.status(400).json({
        message: "Không tìm thấy yêu cầu xóa tài khoản đang hoạt động.",
      });
    }

    if (user.accountDeletionExpiresAt < new Date()) {
      user.accountDeletionCodeHash = undefined;
      user.accountDeletionExpiresAt = undefined;
      user.accountDeletionLastSentAt = undefined;
      await user.save();

      return res.status(400).json({
        message:
          "Yêu cầu xóa tài khoản đã hết hạn sau 5 phút. Vui lòng tạo lại yêu cầu mới.",
      });
    }

    const crypto = await import("crypto");
    const providedCodeHash = crypto
      .createHash("sha256")
      .update(String(code).trim())
      .digest("hex");

    if (providedCodeHash !== user.accountDeletionCodeHash) {
      return res.status(400).json({ message: "Mã xác minh không đúng." });
    }

    const { sendAccountDeletedEmail } = await import("../utils/mail.js");
    const accountEmail = user.email;
    const displayName = user.displayName;

    const { summary } = await permanentlyDeleteUserAccount({
      targetUserId: user._id,
      actorUserId: user._id,
      initiatedBy: "self",
    });

    res.clearCookie("refreshToken");

    try {
      await sendAccountDeletedEmail({
        email: accountEmail,
        displayName,
      });
    } catch (mailError) {
      console.error("Loi sendAccountDeletedEmail", mailError);
    }

    return res.status(200).json({
      success: true,
      message: "Tài khoản đã được xóa.",
      data: summary,
    });
  } catch (error) {
    console.error("Loi deleteMyAccount:", error);
    return res.status(error.status || 500).json({
      message: error.message || "Không thể xóa tài khoản. Vui lòng thử lại.",
    });
  }
};
