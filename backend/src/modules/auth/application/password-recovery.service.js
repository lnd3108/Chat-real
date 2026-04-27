import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../../../models/User.js";
import Session from "../../../models/Session.js";
import PasswordResetOtp from "../../../models/PasswordResetOtp.js";
import { sendPasswordResetOtpEmail } from "../infrastructure/auth-mail.service.js";
import {
  generatePasswordResetOtp,
  generatePasswordResetToken,
  hashOtpValue,
  isOtpFormatValid,
  PASSWORD_RESET_MAX_ATTEMPTS,
  PASSWORD_RESET_MAX_SENDS_PER_HOUR,
  PASSWORD_RESET_OTP_TTL_MS,
  PASSWORD_RESET_RESEND_COOLDOWN_MS,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from "../../../services/otpService.js";
import { isMailConfigured } from "../infrastructure/auth-mail.service.js";

// Các thông báo chung
const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "Nếu email hợp lệ trong hệ thống, mã xác nhận đã được gửi.";
const GENERIC_VERIFY_OTP_MESSAGE =
  "Mã xác nhận không hợp lệ, đã hết hạn hoặc đã được sử dụng.";
const INVALID_RESET_TOKEN_MESSAGE =
  "Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng thực hiện lại từ đầu.";
const PASSWORD_RESET_MAX_SENDS_PER_IP_PER_HOUR = 20;

// Hàm tiện ích để tạo lỗi với cấu trúc thống nhất
const forgotPasswordSchemaError = (message, extra = {}) => ({
  status: 400,
  message,
  ...extra,
});

// Hàm tiện ích để chuẩn hóa email
const getNormalizedEmail = (email) =>
  String(email || "")
    .trim()
    .toLowerCase();

// Hàm tiện ích để ẩn một phần email trong log
const maskEmailForLog = (email) => {
  const normalizedEmail = getNormalizedEmail(email);
  const [localPart, domain] = normalizedEmail.split("@");

  if (!localPart || !domain) {
    return normalizedEmail || "<empty>";
  }

  if (localPart.length <= 2) {
    return `${localPart[0] || "*"}*@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
};

// Hàm tiện ích để kiểm tra định dạng email
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Hàm tiện ích để kiểm tra độ mạnh của mật khẩu
const validateStrongPassword = (password) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);

// Hàm tiện ích để lấy IP người dùng từ request
const getRequestIp = (req) =>
  req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
  req.ip ||
  null;

// Hàm tiện ích để tạo JWT cho phiên đặt lại mật khẩu
const buildResetToken = ({ otpId, userId, email }) =>
  jwt.sign(
    {
      type: "password-reset",
      otpId,
      userId,
      email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: Math.floor(PASSWORD_RESET_TOKEN_TTL_MS / 1000) },
  );

// Hàm tiện ích để xác minh JWT của phiên đặt lại mật khẩu
const verifyResetTokenJwt = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    if (decoded.type !== "password-reset") {
      return { ok: false };
    }

    return { ok: true, decoded };
  } catch {
    return { ok: false };
  }
};

// Hàm tiện ích để vô hiệu hóa các yêu cầu OTP còn hiệu lực trước đó
const invalidateActiveOtpRequests = async ({ userId, email }) => {
  await PasswordResetOtp.updateMany(
    {
      userId,
      email,
      isUsed: false,
      invalidatedAt: null,
    },
    {
      $set: {
        invalidatedAt: new Date(),
      },
    },
  );
};

// Hàm tiện ích để lấy yêu cầu OTP đặt lại mật khẩu chưa được sử dụng gần nhất
const getLatestPasswordResetRequest = async (email) =>
  PasswordResetOtp.findOne({
    email,
    isUsed: false,
  }).sort({ createdAt: -1 });

// Hàm tiện ích để xử lý các yêu cầu OTP đã hết hạn hoặc đã được sử dụng
const consumeInvalidOrExpiredRequest = async (record) => {
  if (!record || record.isUsed || record.invalidatedAt) {
    return;
  }

  if (record.expiresAt <= new Date()) {
    record.invalidatedAt = new Date();
    await record.save();
  }
};

// Hàm chính để xử lý yêu cầu đặt lại mật khẩu
export const requestPasswordReset = async ({ email, req }) => {
  const normalizedEmail = getNormalizedEmail(email);
  const requestIp = getRequestIp(req);

  if (!normalizedEmail) {
    throw forgotPasswordSchemaError("Email không được để trống.");
  }

  if (!validateEmail(normalizedEmail)) {
    throw forgotPasswordSchemaError("Email không đúng định dạng.");
  }

  if (!isMailConfigured()) {
    throw {
      status: 500,
      message: "Hệ thống chưa cấu hình gửi email đặt lại mật khẩu.",
    };
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || user.authProvider !== "local") {
    console.info("[PasswordReset] OTP email skipped", {
      email: maskEmailForLog(normalizedEmail),
      reason: !user ? "user_not_found" : "non_local_auth_provider",
      authProvider: user?.authProvider ?? null,
    });

    return {
      message: GENERIC_FORGOT_PASSWORD_MESSAGE,
      resendAvailableAt: Date.now() + PASSWORD_RESET_RESEND_COOLDOWN_MS,
    };
  }

  const latestRequest = await getLatestPasswordResetRequest(normalizedEmail);
  if (latestRequest) {
    await consumeInvalidOrExpiredRequest(latestRequest);
  }

  const refreshedLatestRequest =
    await getLatestPasswordResetRequest(normalizedEmail);
  const latestSentAt = refreshedLatestRequest?.lastSentAt?.getTime?.();

  if (
    latestSentAt &&
    Date.now() < latestSentAt + PASSWORD_RESET_RESEND_COOLDOWN_MS
  ) {
    throw {
      status: 429,
      message: "Bạn chỉ có thể gửi lại mã sau 60 giây.",
      resendAvailableAt: latestSentAt + PASSWORD_RESET_RESEND_COOLDOWN_MS,
    };
  }

  const hourlyThreshold = new Date(Date.now() - 60 * 60 * 1000);
  const hourlySendCount = await PasswordResetOtp.countDocuments({
    email: normalizedEmail,
    createdAt: { $gte: hourlyThreshold },
  });

  if (hourlySendCount >= PASSWORD_RESET_MAX_SENDS_PER_HOUR) {
    throw {
      status: 429,
      message: "Bạn đã gửi mã quá nhiều lần. Vui lòng thử lại sau.",
      resendAvailableAt: Date.now() + PASSWORD_RESET_RESEND_COOLDOWN_MS,
    };
  }

  if (requestIp) {
    const ipHourlySendCount = await PasswordResetOtp.countDocuments({
      requestIp,
      createdAt: { $gte: hourlyThreshold },
    });

    if (ipHourlySendCount >= PASSWORD_RESET_MAX_SENDS_PER_IP_PER_HOUR) {
      throw {
        status: 429,
        message: "Bạn đã gửi mã quá nhiều lần. Vui lòng thử lại sau.",
        resendAvailableAt: Date.now() + PASSWORD_RESET_RESEND_COOLDOWN_MS,
      };
    }
  }

  await invalidateActiveOtpRequests({
    userId: user._id,
    email: normalizedEmail,
  });

  const otp = generatePasswordResetOtp();
  const now = new Date();

  const otpRecord = await PasswordResetOtp.create({
    userId: user._id,
    email: normalizedEmail,
    otpHash: hashOtpValue(otp),
    expiresAt: new Date(now.getTime() + PASSWORD_RESET_OTP_TTL_MS),
    attempts: 0,
    maxAttempts: PASSWORD_RESET_MAX_ATTEMPTS,
    lastSentAt: now,
    requestIp,
    userAgent: req.headers["user-agent"] || null,
  });

  try {
    await sendPasswordResetOtpEmail({
      email: normalizedEmail,
      code: otp,
      displayName: user.displayName,
    });
  } catch {
    await PasswordResetOtp.deleteOne({ _id: otpRecord._id });
    throw {
      status: 500,
      message: "Không thể gửi email xác nhận lúc này. Vui lòng thử lại sau.",
    };
  }

  return {
    message: GENERIC_FORGOT_PASSWORD_MESSAGE,
    resendAvailableAt: now.getTime() + PASSWORD_RESET_RESEND_COOLDOWN_MS,
  };
};

// Hàm chính để xử lý xác nhận mã OTP đặt lại mật khẩu
export const verifyPasswordResetOtp = async ({ email, otp }) => {
  const normalizedEmail = getNormalizedEmail(email);
  const trimmedOtp = String(otp || "").trim();

  if (!normalizedEmail) {
    throw forgotPasswordSchemaError("Email không được để trống.");
  }

  if (!validateEmail(normalizedEmail)) {
    throw forgotPasswordSchemaError("Email không đúng định dạng.");
  }

  if (!isOtpFormatValid(trimmedOtp)) {
    throw forgotPasswordSchemaError("Mã xác nhận phải gồm đúng 6 chữ số.");
  }

  const request = await getLatestPasswordResetRequest(normalizedEmail);
  if (!request || request.invalidatedAt || request.isUsed) {
    throw {
      status: 400,
      message: GENERIC_VERIFY_OTP_MESSAGE,
    };
  }

  if (request.expiresAt <= new Date()) {
    request.invalidatedAt = new Date();
    await request.save();
    throw {
      status: 400,
      message: "Mã xác nhận đã hết hạn. Vui lòng yêu cầu gửi mã mới.",
    };
  }

  if (request.attempts >= request.maxAttempts) {
    request.invalidatedAt = new Date();
    await request.save();
    throw {
      status: 429,
      message: "Mã xác nhận đã bị khóa do nhập sai quá số lần cho phép.",
    };
  }

  const providedOtpHash = hashOtpValue(trimmedOtp);
  if (providedOtpHash !== request.otpHash) {
    request.attempts += 1;

    if (request.attempts >= request.maxAttempts) {
      request.invalidatedAt = new Date();
    }

    await request.save();

    throw {
      status: request.attempts >= request.maxAttempts ? 429 : 400,
      message:
        request.attempts >= request.maxAttempts
          ? "Mã xác nhận đã bị khóa do nhập sai quá số lần cho phép."
          : "Mã xác nhận không đúng.",
      attemptsRemaining: Math.max(request.maxAttempts - request.attempts, 0),
    };
  }

  const resetToken = generatePasswordResetToken();
  request.resetTokenHash = hashOtpValue(resetToken);
  request.resetTokenExpiresAt = new Date(
    Date.now() + PASSWORD_RESET_TOKEN_TTL_MS,
  );
  request.verifiedAt = new Date();
  request.attempts = 0;
  await request.save();

  return {
    message: "Xác nhận mã thành công. Bạn có thể đặt mật khẩu mới.",
    resetToken: buildResetToken({
      otpId: request._id.toString(),
      userId: request.userId.toString(),
      email: request.email,
    }),
    resetTokenValue: resetToken,
    resetTokenExpiresAt: request.resetTokenExpiresAt.getTime(),
  };
};

// Hàm chính để xử lý đặt lại mật khẩu với mã OTP đã được xác nhận
export const resetPasswordWithVerifiedOtp = async ({
  email,
  resetToken,
  resetTokenValue,
  newPassword,
  confirmPassword,
}) => {
  const normalizedEmail = getNormalizedEmail(email);

  if (!normalizedEmail) {
    throw forgotPasswordSchemaError("Email không được để trống.");
  }

  if (!validateEmail(normalizedEmail)) {
    throw forgotPasswordSchemaError("Email không đúng định dạng.");
  }

  if (!resetToken || !resetTokenValue) {
    throw forgotPasswordSchemaError(
      "Thiếu thông tin xác thực phiên đặt lại mật khẩu.",
    );
  }

  if (!newPassword || !confirmPassword) {
    throw forgotPasswordSchemaError(
      "Vui lòng nhập mật khẩu mới và xác nhận mật khẩu mới.",
    );
  }

  if (!validateStrongPassword(newPassword)) {
    throw forgotPasswordSchemaError(
      "Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.",
    );
  }

  if (newPassword !== confirmPassword) {
    throw forgotPasswordSchemaError("Xác nhận mật khẩu không khớp.");
  }

  const tokenStatus = verifyResetTokenJwt(resetToken);
  if (!tokenStatus.ok || tokenStatus.decoded.email !== normalizedEmail) {
    throw {
      status: 401,
      message: INVALID_RESET_TOKEN_MESSAGE,
    };
  }

  const request = await PasswordResetOtp.findById(tokenStatus.decoded.otpId);
  if (
    !request ||
    request.email !== normalizedEmail ||
    request.isUsed ||
    request.invalidatedAt ||
    !request.resetTokenHash ||
    !request.resetTokenExpiresAt ||
    request.resetTokenExpiresAt <= new Date()
  ) {
    throw {
      status: 401,
      message: INVALID_RESET_TOKEN_MESSAGE,
    };
  }

  if (hashOtpValue(resetTokenValue) !== request.resetTokenHash) {
    throw {
      status: 401,
      message: INVALID_RESET_TOKEN_MESSAGE,
    };
  }

  const user = await User.findById(request.userId);
  if (!user || user.email !== normalizedEmail) {
    throw {
      status: 404,
      message: "Không tìm thấy người dùng tương ứng.",
    };
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.hashedPassword);
  if (isSamePassword) {
    throw {
      status: 400,
      message: "Mật khẩu mới không được trùng với mật khẩu hiện tại.",
    };
  }

  user.hashedPassword = await bcrypt.hash(newPassword, 10);
  await user.save();

  request.isUsed = true;
  request.usedAt = new Date();
  request.invalidatedAt = new Date();
  request.resetTokenHash = null;
  request.resetTokenExpiresAt = null;
  await request.save();

  await PasswordResetOtp.updateMany(
    {
      userId: user._id,
      _id: { $ne: request._id },
      isUsed: false,
      invalidatedAt: null,
    },
    {
      $set: {
        invalidatedAt: new Date(),
      },
    },
  );

  await Session.deleteMany({ userId: user._id });

  return {
    message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại.",
  };
};
