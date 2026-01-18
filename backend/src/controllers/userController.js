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
