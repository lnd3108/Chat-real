import { uploadImageFromBuffer } from "../middlewares/uploadMiddleWare.js";
import User from "../models/User.js";

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

    const result = await uploadImageFromBuffer(file.buffer);
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
