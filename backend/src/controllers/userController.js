import {
  deleteImageFromCloudinary,
  uploadImageFromBuffer,
} from "../middlewares/uploadMiddleWare.js";
import User from "../models/User.js";
import { emitDirectBlockStatusChanged } from "./conversationController.js";

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

export const authMe = async (req, res) => {
  try {
    const user = req.user; // lấy từ middleware

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Lỗi khi gọi authMe", error);
    return res.status(500).json({ message: "Lỗi Hệ Thống" });
  }
};

export const test = async (req, res) => {
  return res.sendStatus(204);
};

export const searchUserByUserName = async (req, res) => {
  try {
    const { userName } = req.query;

    if (!userName || userName.trim() === "") {
      return res
        .status(400)
        .json({ messages: "Cần cung cấp username trong querry." });
    }

    const user = await User.findOne({ userName }).select(
      "_id displayName userName avatarUrl",
    );

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Lỗi xảy ra khi searchUserByUserName", error);
    return res.status(500).json({ message: "Lỗi Hệ thống" });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    const file = req.file;
    const userId = req.user._id;
    if (!file) {
      return res.status(400).json({ message: "Không có file được tải lên" });
    }

    const currentUser = await User.findById(userId).select("avatarId");
    const result = await uploadImageFromBuffer(file.buffer);

    if (currentUser?.avatarId) {
      await deleteImageFromCloudinary(currentUser.avatarId).catch((error) => {
        console.error("KhÃ´ng thá»ƒ xÃ³a avatar cÅ© trÃªn Cloudinary:", error);
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
      return res.status(400).json({ message: "Avatar trả về null" });
    }

    return res.status(200).json({ avatarUrl: updatedUser.avatarUrl });
  } catch (error) {
    console.error("Lỗi khi upload avatar:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

const normalizeString = (v) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

export const updateMe = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { displayName, userName, email, phone, bio } = req.body || {};

    if (!req.body) {
      return res.status(400).json({ message: "Thiếu dữ liệu cập nhật" });
    }

    // debug nhanh
    console.log("PATCH /users/me body:", req.body);

    // ✅ check username trùng (nếu có đổi)
    if (userName) {
      const existedUserName = await User.findOne({
        userName: userName.toLowerCase().trim(),
        _id: { $ne: userId },
      });

      if (existedUserName) {
        return res.status(409).json({ message: "Username đã tồn tại" });
      }
    }

    // ✅ check email trùng (nếu có đổi)
    if (email) {
      const existedEmail = await User.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: userId },
      });

      if (existedEmail) {
        return res.status(409).json({ message: "Email đã tồn tại" });
      }
    }

    const updates = {};

    const nDisplayName = normalizeString(displayName);
    const nUserName = normalizeString(userName);
    const nEmail = normalizeString(email);
    const nPhone = normalizeString(phone); // ✅ "" -> null, null -> null
    const nBio = bio === undefined ? undefined : bio === "" ? null : bio;

    if (nDisplayName !== undefined) updates.displayName = nDisplayName;
    if (nUserName !== undefined) updates.userName = nUserName?.toLowerCase();
    if (nEmail !== undefined) updates.email = nEmail?.toLowerCase();

    // ✅ phone có thể null
    if (nPhone !== undefined) updates.phone = nPhone;

    // ✅ bio có thể null
    if (nBio !== undefined) updates.bio = nBio;

    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).select("-hashedPassword");

    // ✅ ép trả về phone/bio có null nếu không có data
    const userObj = updatedUser?.toObject?.() || updatedUser;
    const safeUser = {
      ...userObj,
      phone: userObj?.phone ?? null,
      bio: userObj?.bio ?? null,
    };

    return res.status(200).json({
      message: "Cập nhật thông tin thành công!",
      user: safeUser,
    });
  } catch (error) {
    console.error("Lỗi updateMe:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
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
      message: "Cập nhật cấu hình thành công!",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Lỗi updatePreferences:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user?._id).select("blockedUsers");

    return res.status(200).json({
      blockedUsers: await formatBlockedUsers(user?.blockedUsers ?? []),
    });
  } catch (error) {
    console.error("Lỗi getBlockedUsers:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const blockUser = async (req, res) => {
  try {
    const actorId = req.user?._id;
    const { targetUserId } = req.params;
    const { reason } = req.body || {};

    if (!targetUserId) {
      return res.status(400).json({ message: "Thiếu người dùng cần chặn" });
    }

    if (actorId.toString() === targetUserId.toString()) {
      return res.status(400).json({ message: "Bạn không thể tự chặn chính mình" });
    }

    const targetUser = await User.findById(targetUserId).select("_id");
    if (!targetUser) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    await User.findByIdAndUpdate(actorId, {
      $pull: { blockedUsers: { userId: targetUserId } },
    });

    const updatedUser = await User.findByIdAndUpdate(
      actorId,
      {
        $push: {
          blockedUsers: {
            userId: targetUserId,
            reason: reason?.trim() || null,
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    ).select("blockedUsers");

    await emitDirectBlockStatusChanged({
      actorUser: req.user,
      targetUserId,
      isBlocked: true,
    });

    return res.status(200).json({
      message: "Đã chặn người dùng",
      blockedUsers: await formatBlockedUsers(updatedUser?.blockedUsers ?? []),
    });
  } catch (error) {
    console.error("Lỗi blockUser:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const actorId = req.user?._id;
    const { targetUserId } = req.params;

    if (!targetUserId) {
      return res.status(400).json({ message: "Thiếu người dùng cần bỏ chặn" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      actorId,
      {
        $pull: { blockedUsers: { userId: targetUserId } },
      },
      { new: true },
    ).select("blockedUsers");

    await emitDirectBlockStatusChanged({
      actorUser: req.user,
      targetUserId,
      isBlocked: false,
    });

    return res.status(200).json({
      message: "Đã bỏ chặn người dùng",
      blockedUsers: await formatBlockedUsers(updatedUser?.blockedUsers ?? []),
    });
  } catch (error) {
    console.error("Lỗi unblockUser:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
