import EmailChangeVerification from "../models/EmailChangeVerification.js";
import User from "../models/User.js";
import {
  isMailConfigured,
  sendEmailChangeVerificationEmail,
} from "../utils/mail.js";
import {
  generatePasswordResetOtp,
  hashOtpValue,
  isOtpFormatValid,
  PASSWORD_RESET_MAX_ATTEMPTS,
  PASSWORD_RESET_MAX_SENDS_PER_HOUR,
  PASSWORD_RESET_OTP_TTL_MS,
  PASSWORD_RESET_RESEND_COOLDOWN_MS,
} from "./otpService.js";
import { sanitizeUser } from "../utils/sanitizeUser.js";
import { normalizeRole } from "./rbacService.js";

const EMAIL_CHANGE_MAX_SENDS_PER_IP_PER_HOUR = 20;
const EMAIL_CHANGE_GENERIC_MESSAGE = "Mã xác minh đã được gửi tới email mới.";

const profileError = (message, status = 400, extra = {}) => ({
  status,
  message,
  ...extra,
});

const normalizeString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
};

const normalizeEmail = (email) => {
  const normalized = normalizeString(email);
  return normalized ? normalized.toLowerCase() : normalized;
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));

const getRequestIp = (req) =>
  req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
  req.ip ||
  null;

const normalizeUserRoleForSave = (user) => {
  if (!user) return;
  user.role = normalizeRole(user);
};

const buildPendingProfile = (payload) => ({
  displayName: normalizeString(payload.displayName),
  userName: normalizeString(payload.userName)?.toLowerCase() ?? null,
  phone: normalizeString(payload.phone),
  bio: payload.bio === undefined ? undefined : payload.bio === "" ? null : String(payload.bio),
});

const validateProfilePayload = async ({
  userId,
  currentUser,
  payload,
  requireEmailChange = false,
}) => {
  const pendingProfile = buildPendingProfile(payload);
  const nextEmail = normalizeEmail(payload.email);

  if (!pendingProfile.displayName) {
    throw profileError("Tên hiển thị không được để trống.");
  }

  if (!pendingProfile.userName || pendingProfile.userName.length < 3) {
    throw profileError("Tên người dùng phải có ít nhất 3 ký tự.");
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(pendingProfile.userName)) {
    throw profileError("Tên người dùng chỉ chứa chữ, số, gạch ngang và gạch dưới.");
  }

  if (!nextEmail) {
    throw profileError("Email không được để trống.");
  }

  if (!validateEmail(nextEmail)) {
    throw profileError("Email không đúng định dạng.");
  }

  const existedUserName = await User.findOne({
    userName: pendingProfile.userName,
    _id: { $ne: userId },
  }).select("_id");

  if (existedUserName) {
    throw profileError("Tên người dùng đã tồn tại.", 409);
  }

  const existedEmail = await User.findOne({
    email: nextEmail,
    _id: { $ne: userId },
  }).select("_id");

  if (existedEmail) {
    throw profileError("Email này đã được sử dụng.", 409);
  }

  if (requireEmailChange && nextEmail === currentUser.email) {
    throw profileError("Email mới không được trùng email hiện tại.");
  }

  return {
    nextEmail,
    pendingProfile,
  };
};

const invalidatePendingEmailChanges = async (userId, newEmail = null) => {
  const query = {
    userId,
    isUsed: false,
    invalidatedAt: null,
  };

  const normalizedEmail = newEmail ? normalizeEmail(newEmail) : null;
  if (normalizedEmail) {
    query.newEmail = normalizedEmail;
  }

  await EmailChangeVerification.updateMany(query, {
    $set: {
      invalidatedAt: new Date(),
    },
  });
};

const getActiveEmailChange = async ({ userId, newEmail }) =>
  EmailChangeVerification.findOne({
    userId,
    newEmail,
    isUsed: false,
    invalidatedAt: null,
  }).sort({ createdAt: -1 });

const getHourlyEmailChangeSendTotal = async (userId, fromDate) => {
  const [result] = await EmailChangeVerification.aggregate([
    {
      $match: {
        userId,
        createdAt: { $gte: fromDate },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$sendCount" },
      },
    },
  ]);

  return result?.total ?? 0;
};

const sendEmailChangeOtp = async ({ user, newEmail, pendingProfile, req }) => {
  if (!isMailConfigured()) {
    throw profileError("Hệ thống chưa cấu hình gửi email xác minh.", 500);
  }

  const requestIp = getRequestIp(req);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const userHourlyCount = await getHourlyEmailChangeSendTotal(user._id, oneHourAgo);
  if (userHourlyCount >= PASSWORD_RESET_MAX_SENDS_PER_HOUR) {
    throw profileError(
      "Bạn đã gửi mã quá nhiều lần. Vui lòng thử lại sau.",
      429,
      { resendAfter: Date.now() + PASSWORD_RESET_RESEND_COOLDOWN_MS },
    );
  }

  if (requestIp) {
    const ipHourlyCount = await EmailChangeVerification.countDocuments({
      requestIp,
      createdAt: { $gte: oneHourAgo },
    });

    if (ipHourlyCount >= EMAIL_CHANGE_MAX_SENDS_PER_IP_PER_HOUR) {
      throw profileError(
        "Bạn đã gửi mã quá nhiều lần. Vui lòng thử lại sau.",
        429,
        { resendAfter: Date.now() + PASSWORD_RESET_RESEND_COOLDOWN_MS },
      );
    }
  }

  await invalidatePendingEmailChanges(user._id);

  const otp = generatePasswordResetOtp();
  const now = new Date();

  const verification = await EmailChangeVerification.create({
    userId: user._id,
    oldEmail: user.email,
    newEmail,
    pendingProfile,
    otpHash: hashOtpValue(otp),
    expiresAt: new Date(now.getTime() + PASSWORD_RESET_OTP_TTL_MS),
    attempts: 0,
    maxAttempts: PASSWORD_RESET_MAX_ATTEMPTS,
    lastSentAt: now,
    sendCount: 1,
    requestIp,
    userAgent: req.headers["user-agent"] || null,
  });

  try {
    await sendEmailChangeVerificationEmail({
      email: newEmail,
      code: otp,
      displayName: user.displayName,
    });
  } catch {
    await EmailChangeVerification.deleteOne({ _id: verification._id });
    throw profileError(
      "Không thể gửi mã xác minh tới email mới lúc này. Vui lòng thử lại sau.",
      500,
    );
  }

  return {
    success: true,
    mode: "email_verification_required",
    pendingEmail: newEmail,
    resendAfter: now.getTime() + PASSWORD_RESET_RESEND_COOLDOWN_MS,
    message: EMAIL_CHANGE_GENERIC_MESSAGE,
  };
};

export const updateMyProfile = async ({ userId, payload, req }) => {
  const currentUser = await User.findById(userId);
  if (!currentUser) {
    throw profileError("Không tìm thấy người dùng.", 404);
  }

  const { nextEmail, pendingProfile } = await validateProfilePayload({
    userId,
    currentUser,
    payload,
    requireEmailChange: false,
  });

  const isEmailChanged = nextEmail !== currentUser.email;

  if (!isEmailChanged) {
    normalizeUserRoleForSave(currentUser);
    currentUser.displayName = pendingProfile.displayName;
    currentUser.userName = pendingProfile.userName;
    currentUser.phone = pendingProfile.phone;
    currentUser.bio = pendingProfile.bio ?? null;
    await currentUser.save();

    await invalidatePendingEmailChanges(userId);

    return {
      success: true,
      mode: "updated",
      user: sanitizeUser(currentUser),
      message: "Cập nhật thông tin thành công.",
    };
  }

  return sendEmailChangeOtp({
    user: currentUser,
    newEmail: nextEmail,
    pendingProfile,
    req,
  });
};

export const resendEmailChangeOtp = async ({ userId, newEmail, req }) => {
  const normalizedEmail = normalizeEmail(newEmail);

  if (!normalizedEmail) {
    throw profileError("Email mới không được để trống.");
  }

  if (!validateEmail(normalizedEmail)) {
    throw profileError("Email không đúng định dạng.");
  }

  const currentUser = await User.findById(userId);
  if (!currentUser) {
    throw profileError("Không tìm thấy người dùng.", 404);
  }

  const pending = await getActiveEmailChange({
    userId,
    newEmail: normalizedEmail,
  });

  if (!pending) {
    throw profileError(
      "Không tìm thấy phiên xác minh email đang chờ. Vui lòng lưu lại thay đổi trước.",
      404,
    );
  }

  if (pending.expiresAt <= new Date()) {
    pending.invalidatedAt = new Date();
    await pending.save();
    throw profileError("Mã xác minh đã hết hạn. Vui lòng lưu lại thay đổi để nhận mã mới.");
  }

  const resendAvailableAt = pending.lastSentAt.getTime() + PASSWORD_RESET_RESEND_COOLDOWN_MS;
  if (Date.now() < resendAvailableAt) {
    throw profileError("Bạn chỉ có thể gửi lại mã sau 60 giây.", 429, {
      resendAfter: resendAvailableAt,
    });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const hourlyCount = await getHourlyEmailChangeSendTotal(userId, oneHourAgo);
  if (hourlyCount >= PASSWORD_RESET_MAX_SENDS_PER_HOUR) {
    throw profileError("Bạn đã gửi mã quá nhiều lần. Vui lòng thử lại sau.", 429, {
      resendAfter: Date.now() + PASSWORD_RESET_RESEND_COOLDOWN_MS,
    });
  }

  const otp = generatePasswordResetOtp();
  pending.otpHash = hashOtpValue(otp);
  pending.expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MS);
  pending.attempts = 0;
  pending.lastSentAt = new Date();
  pending.sendCount += 1;
  pending.requestIp = getRequestIp(req);
  pending.userAgent = req.headers["user-agent"] || null;
  await pending.save();

  await sendEmailChangeVerificationEmail({
    email: normalizedEmail,
    code: otp,
    displayName: currentUser.displayName,
  });

  return {
    success: true,
    pendingEmail: normalizedEmail,
    resendAfter: pending.lastSentAt.getTime() + PASSWORD_RESET_RESEND_COOLDOWN_MS,
    message: EMAIL_CHANGE_GENERIC_MESSAGE,
  };
};

export const verifyEmailChangeOtp = async ({ userId, newEmail, otp }) => {
  const normalizedEmail = normalizeEmail(newEmail);
  const trimmedOtp = String(otp || "").trim();

  if (!normalizedEmail) {
    throw profileError("Email mới không được để trống.");
  }

  if (!validateEmail(normalizedEmail)) {
    throw profileError("Email không đúng định dạng.");
  }

  if (!isOtpFormatValid(trimmedOtp)) {
    throw profileError("OTP phải gồm đúng 6 chữ số.");
  }

  const verification = await getActiveEmailChange({
    userId,
    newEmail: normalizedEmail,
  });

  if (!verification) {
    throw profileError(
      "Không tìm thấy phiên xác minh email đang chờ. Vui lòng lưu lại thay đổi trước.",
      404,
    );
  }

  if (verification.expiresAt <= new Date()) {
    verification.invalidatedAt = new Date();
    await verification.save();
    throw profileError("Mã xác minh đã hết hạn. Vui lòng gửi lại mã mới.");
  }

  if (verification.attempts >= verification.maxAttempts) {
    verification.invalidatedAt = new Date();
    await verification.save();
    throw profileError(
      "Mã xác minh đã bị khóa do nhập sai quá số lần cho phép.",
      429,
    );
  }

  if (hashOtpValue(trimmedOtp) !== verification.otpHash) {
    verification.attempts += 1;
    if (verification.attempts >= verification.maxAttempts) {
      verification.invalidatedAt = new Date();
    }
    await verification.save();

    throw profileError(
      verification.attempts >= verification.maxAttempts
        ? "Mã xác minh đã bị khóa do nhập sai quá số lần cho phép."
        : "Mã xác minh không đúng.",
      verification.attempts >= verification.maxAttempts ? 429 : 400,
    );
  }

  const user = await User.findById(userId);
  if (!user) {
    throw profileError("Không tìm thấy người dùng.", 404);
  }

  normalizeUserRoleForSave(user);

  const existedEmail = await User.findOne({
    email: normalizedEmail,
    _id: { $ne: userId },
  }).select("_id");

  if (existedEmail) {
    throw profileError("Email này đã được sử dụng.", 409);
  }

  const pendingProfile = verification.pendingProfile || {};
  const existedUserName = await User.findOne({
    userName: pendingProfile.userName,
    _id: { $ne: userId },
  }).select("_id");

  if (existedUserName) {
    throw profileError("Tên người dùng đã tồn tại.", 409);
  }

  user.email = normalizedEmail;
  user.emailVerified = true;
  user.displayName = pendingProfile.displayName;
  user.userName = pendingProfile.userName;
  user.phone = pendingProfile.phone ?? null;
  user.bio = pendingProfile.bio ?? null;
  await user.save();

  verification.isUsed = true;
  verification.usedAt = new Date();
  verification.invalidatedAt = new Date();
  await verification.save();

  await invalidatePendingEmailChanges(userId);

  return {
    success: true,
    user: sanitizeUser(user),
    message: "Cập nhật thông tin thành công.",
  };
};

export const cancelEmailChangeVerification = async ({ userId, newEmail = null }) => {
  await invalidatePendingEmailChanges(userId, newEmail);

  return {
    success: true,
    message: "Đã hủy phiên xác minh email đang chờ.",
  };
};
