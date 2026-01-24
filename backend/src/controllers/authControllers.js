import bcrypt from "bcrypt";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import Session from "../models/Session.js";
import crypto from "crypto";

const ACCESS_TOKEN_TTL = "30m"; //Thường dưới 15m
const REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60 * 1000;

export const signUp = async (req, res) => {
  try {
    const { userName, password, email, firstName, lastName } = req.body;

    if (!userName || !password || !email || !firstName || !lastName) {
      return res.status(400).json({
        message:
          "Không thể thiếu username, password, email, firstName và lastName",
      });
    }

    // Kiểm tra username tồn tại chưa
    const duplicate = await User.findOne({ userName });

    if (duplicate) {
      return res.status(409).json({
        message: "userName đã tồn tại",
      });
    }

    // mã hóa password
    const hashedPassword = await bcrypt.hash(password, 10); //salt = 10

    // tạo user mới
    await User.create({
      userName,
      hashedPassword,
      email,
      displayName: `${lastName} ${firstName}`,
    });

    // return
    return res.sendStatus(204);
  } catch (error) {
    console.error(`Lỗi khi gọi signUp`, error);
    return res.status(500).json({
      message: "Lỗi Hệ Thống",
    });
  }
};

export const signIn = async (req, res) => {
  try {
    // lấy inputs
    const { userName, password } = req.body;

    if (!userName || !password) {
      return res.status(400).json({ message: "Thiếu userName hoặc PassWord" });
    }

    //lấy hashedPassWord trong db về để so với pasword trong ô input
    const user = await User.findOne({ userName });

    if (!user) {
      return res
        .status(401)
        .json({ message: "userName hoặc Password không chính xác" });
    }

    //Kiểm tra password
    const passwordCorrect = await bcrypt.compare(password, user.hashedPassword);

    if (!passwordCorrect) {
      return res.status(401).json({
        message: "username hoặc passWord không chính xác",
      });
    }

    //nếu khớp, tạo accessToken với JWT
    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    //tạo refresh token
    const refreshToken = crypto.randomBytes(64).toString("hex");

    //tạo session mới để lưu refresh token
    await Session.create({
      userId: user._id,
      refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL),
    });

    //trả refresh token về trong cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none", //backend, frontend Deploy riêng
      maxAge: REFRESH_TOKEN_TTL,
    });

    //trả access token về trong res
    return res.status(200).json({
      message: `User ${user.displayName} đã logged in!`,
      accessToken,
    });
  } catch (error) {
    console.error(`Lỗi khi gọi signIn`, error);
    return res.status(500).json({
      message: "Lỗi Hệ Thống",
    });
  }
};

export const signOut = async (req, res) => {
  try {
    //Lấy refresh token từ cookie
    const token = req.cookies?.refreshToken;

    if (token) {
      //xóa refresh token trong session
      await Session.deleteOne({ refreshToken: token });
      // xóa cookie

      res.clearCookie("refreshToken");
    }

    return res.sendStatus(204);
  } catch (error) {
    console.error(`Lỗi khi gọi signIn`, error);
    return res.status(500).json({
      message: "Lỗi Hệ Thống",
    });
  }
};

//tạo access token mới từ refresh token
export const refreshToken = async (req, res) => {
  try {
    //Lấy refreshToken từ cookie
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ message: "Token không tồn tại." });
    }

    //so với refreshT token trong db
    const session = await Session.findOne({ refreshToken: token });
    if (!session) {
      return res
        .status(403)
        .json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    }

    //kiểm tra hết hạn chưa
    if (session.expiresAt < new Date()) {
      return res.status(403).json({ message: "token đã hết hạn" });
    }

    // tạo access token mới
    const accessToken = jwt.sign(
      { userId: session.userId },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    //return
    return res.status(200).json({ accessToken });
  } catch (error) {
    console.error(`Lỗi khi gọi refreshToken`, error);
    return res.status(500).json({
      message: "Lỗi Hệ Thống",
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user?._id;

    const { currentPassword, newPassword, confirmPassword } = req.body;

    // validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "Thiếu currentPassword, newPassword hoặc confirmPassword",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "confirmPassword không khớp với newPassword",
      });
    }

    // lấy user đầy đủ (có hashedPassword)
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // kiểm tra mật khẩu hiện tại
    const isCorrect = await bcrypt.compare(
      currentPassword,
      user.hashedPassword,
    );
    if (!isCorrect) {
      return res.status(401).json({ message: "Mật khẩu hiện tại không đúng" });
    }

    // tránh đổi trùng mật khẩu cũ
    const isSameAsOld = await bcrypt.compare(newPassword, user.hashedPassword);
    if (isSameAsOld) {
      return res.status(400).json({
        message: "Mật khẩu mới không được trùng mật khẩu cũ",
      });
    }

    // hash & save
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.hashedPassword = hashedPassword;
    await user.save();

    //logout toàn bộ session refreshToken
    await Session.deleteMany({ userId: user._id });

    // clear cookie refreshToken hiện tại luôn
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return res.status(200).json({
      message: "Đổi mật khẩu thành công! Vui lòng đăng nhập lại.",
    });
  } catch (error) {
    console.error("Lỗi khi gọi changePassword", error);
    return res.status(500).json({ message: "Lỗi Hệ Thống" });
  }
};

export const deleteAccount = async (req, res) => {
  const userId = req.user._id;

  await User.findByIdAndDelete(userId);

  // clear cookie (nếu dùng jwt cookie)
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  return res.status(200).json({
    message: "Xoá tài khoản thành công!",
  });
};
