import bcrypt from "bcrypt";
import User from "../../../models/User.js";
import { ADMIN_SOCKET_EVENTS } from "../../../constants/socketEvents.js";
import { sendEmailVerificationForUser } from "./verification.service.js";
import { emitAuthLifecycle } from "../infrastructure/auth-realtime.service.js";
import { ensureMaintenanceAccess } from "../infrastructure/maintenance-access.service.js";
import { invalidateAdminDashboardCache } from "../../admin-panel/infrastructure/cache/admin-dashboard-cache.service.js";

// Hàm xử lý đăng ký người dùng mới
export const signUpUser = async ({
  userName,
  password,
  email,
  firstName,
  lastName,
}) => {
  // Kiểm tra xem có đang trong thời gian bảo trì hay không
  const maintenanceStatus = await ensureMaintenanceAccess(null);
  // Nếu đang bảo trì, trả về thông báo và không cho phép đăng ký
  if (!maintenanceStatus.allowed) {
    return maintenanceStatus;
  }

  // Chuẩn hóa userName và email để tránh trùng lặp do khác biệt về chữ hoa chữ thường
  const normalizedUserName = userName.toLowerCase();
  const normalizedEmail = email.toLowerCase();

  // Kiểm tra xem userName hoặc email đã tồn tại chưa
  const duplicate = await User.findOne({ userName: normalizedUserName });
  const duplicateEmail = await User.findOne({ email: normalizedEmail });

  // Kiểm tra xem có tài khoản nào đang chờ xác minh email với userName hoặc email này không
  const pendingUser =
    duplicate &&
    !duplicate.emailVerified &&
    duplicate.authProvider === "local" &&
    duplicate.email === normalizedEmail
      ? duplicate
      : duplicateEmail &&
          !duplicateEmail.emailVerified &&
          duplicateEmail.authProvider === "local"
        ? duplicateEmail
        : null;

  // Nếu có tài khoản đang chờ xác minh, gửi lại email xác minh và thông báo cho người dùng
  if (pendingUser) {
    const verification = await sendEmailVerificationForUser(
      pendingUser,
      "signup",
      {
        ignoreCooldown: false,
      },
    );

    // Nếu gửi lại mã xác minh thành công, trả về thông báo cho người dùng
    if (!verification.ok) {
      return {
        status: verification.status,
        body: {
          message: verification.message,
          resendAvailableAt: verification.resendAvailableAt,
        },
      };
    }

    // Nếu đã gửi lại mã xác minh thành công, trả về thông báo cho người dùng
    return {
      status: 200,
      body: {
        ...verification.payload,
        message:
          "Tài khoản của bạn đang chờ xác minh email. Chúng tôi đã gửi lại mã xác minh.",
      },
    };
  }

  // Nếu không có tài khoản nào đang chờ xác minh, tiếp tục kiểm tra trùng lặp bình thường
  if (duplicate) {
    return { status: 409, body: { message: "userName đã tồn tại" } };
  }

  // Kiểm tra trùng lặp email
  if (duplicateEmail) {
    return { status: 409, body: { message: "Email đã tồn tại" } };
  }

  // Tạo người dùng mới
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    userName: normalizedUserName,
    hashedPassword,
    email: normalizedEmail,
    displayName: `${lastName} ${firstName}`,
    authProvider: "local",
    emailVerified: false,
  });

  // Phát sự kiện người dùng mới đăng ký
  emitAuthLifecycle(ADMIN_SOCKET_EVENTS.USER_NEW, user);
  await invalidateAdminDashboardCache("user-registered");

  // Gửi email xác minh cho người dùng mới
  const verification = await sendEmailVerificationForUser(user, "signup", {
    ignoreCooldown: true,
  });
  if (!verification.ok) {
    return {
      status: verification.status,
      body: {
        message: verification.message,
        resendAvailableAt: verification.resendAvailableAt,
      },
    };
  }

  return {
    status: 201,
    body: verification.payload,
  };
};
