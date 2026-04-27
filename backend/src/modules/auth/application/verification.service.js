import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../../../models/User.js";
import {
  isMailConfigured,
  sendAccountDeletionCodeEmail,
  sendVerificationCodeEmail,
} from "../infrastructure/auth-mail.service.js";

// TTL: Time To Live (thời gian tồn tại) của mã xác minh email và mã xác minh xóa tài khoản
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_TOKEN_TTL = "10m";
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
const ACCOUNT_DELETION_CODE_TTL_MS = 5 * 60 * 1000;
const ACCOUNT_DELETION_RESEND_COOLDOWN_MS = 60 * 1000;

// Hàm tạo mã xác minh email ngẫu nhiên
const generateEmailCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

// Hàm băm mã xác minh email để lưu vào cơ sở dữ liệu
const hashEmailCode = (code) =>
  crypto.createHash("sha256").update(code).digest("hex");

// Hàm xác minh token email và lấy payload
export const createPendingVerificationToken = (user, purpose) =>
  jwt.sign(
    {
      userId: user._id,
      email: user.email,
      type: "email-verification",
      purpose,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: EMAIL_TOKEN_TTL },
  );

// Hàm xử lý gửi mã xác minh email cho người dùng
export const buildPendingVerificationResponse = (user, purpose, message) => ({
  requiresEmailVerification: true,
  verificationToken: createPendingVerificationToken(user, purpose),
  email: user.email,
  purpose,
  resendAvailableAt:
    (user.emailVerificationLastSentAt?.getTime?.() || Date.now()) +
    EMAIL_RESEND_COOLDOWN_MS,
  message,
});

// Hàm kiểm tra xem người dùng có thể gửi lại mã xác minh email hay không dựa trên thời gian cooldown
const canResendVerification = (user) => {
  // Nếu chưa từng gửi mã xác minh, cho phép gửi
  const lastSentAt = user.emailVerificationLastSentAt?.getTime?.();
  if (!lastSentAt) {
    return { ok: true, resendAvailableAt: Date.now() };
  }

  // Tính toán thời điểm có thể gửi lại mã xác minh dựa trên thời gian cooldown
  const resendAvailableAt = lastSentAt + EMAIL_RESEND_COOLDOWN_MS;
  if (Date.now() < resendAvailableAt) {
    return { ok: false, resendAvailableAt };
  }

  return { ok: true, resendAvailableAt };
};

// Hàm lưu mã xác minh email đã được băm vào cơ sở dữ liệu cùng với thời gian hết hạn và thời gian gửi lần cuối
const persistVerificationCode = async (user) => {
  const code = generateEmailCode();
  user.emailVerificationCodeHash = hashEmailCode(code);
  user.emailVerificationExpiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);
  user.emailVerificationLastSentAt = new Date();
  await user.save();
  return code;
};

// Hàm kiểm tra xem người dùng có thể gửi lại mã xác minh xóa tài khoản hay không dựa trên thời gian cooldown
const canResendAccountDeletionCode = (user) => {
  // Nếu chưa từng gửi mã xác minh xóa tài khoản, cho phép gửi
  const lastSentAt = user.accountDeletionLastSentAt?.getTime?.();
  if (!lastSentAt) {
    return { ok: true, resendAvailableAt: Date.now() };
  }

  // Tính toán thời điểm có thể gửi lại mã xác minh xóa tài khoản dựa trên thời gian cooldown
  const resendAvailableAt = lastSentAt + ACCOUNT_DELETION_RESEND_COOLDOWN_MS;
  if (Date.now() < resendAvailableAt) {
    return { ok: false, resendAvailableAt };
  }

  return { ok: true, resendAvailableAt };
};

// Hàm lưu mã xác minh xóa tài khoản đã được băm vào cơ sở dữ liệu cùng với thời gian hết hạn và thời gian gửi lần cuối
const persistAccountDeletionCode = async (user) => {
  const code = generateEmailCode();
  user.accountDeletionCodeHash = hashEmailCode(code);
  user.accountDeletionExpiresAt = new Date(
    Date.now() + ACCOUNT_DELETION_CODE_TTL_MS,
  );
  user.accountDeletionLastSentAt = new Date();
  await user.save();
  return code;
};

// Hàm xóa trạng thái yêu cầu xóa tài khoản của người dùng
const clearAccountDeletionState = async (user) => {
  user.accountDeletionCodeHash = undefined;
  user.accountDeletionExpiresAt = undefined;
  user.accountDeletionLastSentAt = undefined;
  await user.save();
};

// Hàm kiểm tra xem người dùng có đang có yêu cầu xóa tài khoản nào đang chờ xử lý hay không
const hasActiveAccountDeletionRequest = (user) =>
  Boolean(
    user.accountDeletionCodeHash &&
    user.accountDeletionExpiresAt &&
    user.accountDeletionExpiresAt > new Date(),
  );

// Hàm xác minh token email và lấy payload
export const buildAccountDeletionResponse = (user, message) => ({
  message,
  email: user.email,
  expiresAt:
    user.accountDeletionExpiresAt?.getTime?.() ||
    Date.now() + ACCOUNT_DELETION_CODE_TTL_MS,
  resendAvailableAt:
    (user.accountDeletionLastSentAt?.getTime?.() || Date.now()) +
    ACCOUNT_DELETION_RESEND_COOLDOWN_MS,
});

// Hàm trao đổi mã code lấy từ Google để lấy access token và ID token
const getVerificationMessage = (purpose) =>
  purpose === "signup"
    ? "Đã gửi mã xác minh tới email của bạn. Vui lòng xác minh trước khi đăng nhập."
    : "Đã gửi mã xác minh tới Gmail của bạn.";

// Hàm trao đổi mã code lấy từ Google để lấy access token và ID token
export const sendEmailVerificationForUser = async (
  user,
  purpose,
  options = { ignoreCooldown: false },
) => {
  if (!isMailConfigured()) {
    return {
      ok: false,
      status: 500,
      message: "Hệ thống chưa cấu hình SMTP để gửi mã xác minh email.",
    };
  }

  if (!options.ignoreCooldown) {
    const cooldown = canResendVerification(user);
    if (!cooldown.ok) {
      return {
        ok: false,
        status: 429,
        message: "Bạn chỉ có thể gửi lại mã sau 60 giây.",
        resendAvailableAt: cooldown.resendAvailableAt,
      };
    }
  }

  const code = await persistVerificationCode(user);
  await sendVerificationCodeEmail({
    email: user.email,
    code,
    displayName: user.displayName,
  });

  return {
    ok: true,
    payload: buildPendingVerificationResponse(
      user,
      purpose,
      getVerificationMessage(purpose),
    ),
  };
};

// Hàm tiện ích để lấy payload từ ID token của Google
export const sendAccountDeletionCodeForUser = async (
  user,
  options = { ignoreCooldown: false },
) => {
  // Kiểm tra xem hệ thống đã cấu hình SMTP để gửi email xác minh xóa tài khoản chưa
  if (!isMailConfigured()) {
    return {
      ok: false,
      status: 500,
      message: "Hệ thống chưa cấu hình SMTP để gửi mã xác minh xóa tài khoản.",
    };
  }
  // Kiểm tra xem người dùng có thể gửi lại mã xác minh xóa tài khoản hay không dựa trên thời gian cooldown
  if (
    user.accountDeletionExpiresAt &&
    user.accountDeletionExpiresAt <= new Date() &&
    (user.accountDeletionCodeHash || user.accountDeletionLastSentAt)
  ) {
    await clearAccountDeletionState(user);
  }

  if (hasActiveAccountDeletionRequest(user) && !options.ignoreCooldown) {
    const cooldown = canResendAccountDeletionCode(user);
    if (!cooldown.ok) {
      return {
        ok: true,
        payload: buildAccountDeletionResponse(
          user,
          "Bạn đang có một yêu cầu xóa tài khoản chưa hoàn tất. Vui lòng nhập mã xác minh hoặc chờ trước khi gửi lại mã.",
        ),
      };
    }
  }

  // Nếu có thể gửi lại mã xác minh xóa tài khoản, tạo mã mới, lưu vào cơ sở dữ liệu và gửi email cho người dùng
  if (!options.ignoreCooldown) {
    const cooldown = canResendAccountDeletionCode(user);
    if (!cooldown.ok) {
      return {
        ok: false,
        status: 429,
        message: "Bạn chỉ có thể gửi lại mã sau 60 giây.",
        resendAvailableAt: cooldown.resendAvailableAt,
      };
    }
  }

  // Tạo mã xác minh xóa tài khoản mới, lưu vào cơ sở dữ liệu và gửi email cho người dùng
  const code = await persistAccountDeletionCode(user);
  await sendAccountDeletionCodeEmail({
    email: user.email,
    code,
    displayName: user.displayName,
  });

  // Trả về phản hồi thành công cùng với thông tin về mã xác minh xóa tài khoản đã được gửi
  return {
    ok: true,
    payload: buildAccountDeletionResponse(
      user,
      "Đã gửi mã xác minh xóa tài khoản tới email của bạn. Mã có hiệu lực trong 5 phút.",
    ),
  };
};

// Hàm tiện ích để lấy payload từ ID token của Google
export const verifyPendingToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    if (decoded.type !== "email-verification") {
      return {
        ok: false,
        status: 401,
        message: "Sai loại verification token.",
      };
    }

    return { ok: true, decoded };
  } catch {
    return {
      ok: false,
      status: 401,
      message: "Verification token không hợp lệ.",
    };
  }
};

// Hàm tiện ích để lấy payload từ ID token của Google
export const hashVerificationCode = hashEmailCode;

// Hàm tiện ích để lấy payload từ ID token của Google
export const getUserById = (userId) => User.findById(userId);
