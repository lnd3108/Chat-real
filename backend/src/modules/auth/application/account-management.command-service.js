import bcrypt from "bcrypt";
import User from "../../../models/User.js";
import Session from "../../../models/Session.js";
import { deleteMyAccountCommand } from "../../user-profile/application/user-profile.service.js";
import { sendAccountDeletionCodeForUser } from "./verification.service.js";

// Đổi mật khẩu cho người dùng đã xác thực
export const changePasswordForUser = async ({
  userId,
  currentPassword,
  newPassword,
  confirmPassword,
  res,
}) => {
  if (!currentPassword || !newPassword || !confirmPassword) {
    return {
      status: 400,
      body: {
        message: "Thiếu currentPassword, newPassword hoặc confirmPassword",
      },
    };
  }

  if (newPassword.length < 6) {
    return {
      status: 400,
      body: {
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      },
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      status: 400,
      body: { message: "confirmPassword không khớp với newPassword" },
    };
  }

  const user = await User.findById(userId);
  if (!user) {
    return {
      status: 404,
      body: { message: "Người dùng không tồn tại" },
    };
  }

  const isCorrect = await bcrypt.compare(currentPassword, user.hashedPassword);
  if (!isCorrect) {
    return {
      status: 401,
      body: { message: "Mật khẩu hiện tại không đúng" },
    };
  }

  const isSameAsOld = await bcrypt.compare(newPassword, user.hashedPassword);
  if (isSameAsOld) {
    return {
      status: 400,
      body: {
        message: "Mật khẩu mới không được trùng mật khẩu cũ",
      },
    };
  }

  user.hashedPassword = await bcrypt.hash(newPassword, 10);
  await user.save();
  await Session.deleteMany({ userId: user._id });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });

  return {
    status: 200,
    body: {
      message: "Đổi mật khẩu thành công! Vui lòng đăng nhập lại.",
    },
  };
};

// Yêu cầu xóa tài khoản cho người dùng đã xác thực
export const requestAuthenticatedAccountDeletion = async ({ userId }) => {
  const user = await User.findById(userId);
  if (!user) {
    return { status: 404, body: { message: "Không tìm thấy người dùng." } };
  }

  const deletion = await sendAccountDeletionCodeForUser(user, {
    ignoreCooldown: false,
  });

  if (!deletion.ok) {
    return {
      status: deletion.status,
      body: {
        message: deletion.message,
        resendAvailableAt: deletion.resendAvailableAt,
      },
    };
  }

  return { status: 200, body: deletion.payload };
};

// Xác nhận xóa tài khoản cho người dùng đã xác thực
export const confirmAuthenticatedAccountDeletion = async ({
  user,
  body,
  res,
}) => {
  const result = await deleteMyAccountCommand({ user, body });
  if (result.error) {
    return {
      status: result.error.status,
      body: { message: result.error.message },
    };
  }

  if (result.clearRefreshToken) {
    res.clearCookie("refreshToken");
  }

  return {
    status: result.status,
    body: result.payload,
  };
};
