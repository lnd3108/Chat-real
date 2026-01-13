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
      "_id displayName userName avatarUrl"
    );

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Lỗi xảy ra khi searchUserByUserName", error);
    return res.status(500).json({ message: "Lỗi Hệ thống" });
  }
};
