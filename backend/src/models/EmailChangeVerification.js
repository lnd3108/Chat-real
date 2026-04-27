import mongoose from "mongoose";

// Bản schema này lưu trữ thông tin về quá trình xác minh thay đổi email của người dùng, bao gồm:
// - userId: ID của người dùng thực hiện thay đổi email.
// - oldEmail: Email cũ của người dùng.
// - newEmail: Email mới mà người dùng muốn chuyển sang.
// - pendingProfile: Thông tin tạm thời về hồ sơ người dùng trong quá trình xác minh, có thể bao gồm displayName, userName, phone, bio.
// - otpHash: Hash của mã OTP được gửi đến email mới để xác minh.
// - expiresAt: Thời điểm mã OTP hết hạn.
// - attempts: Số lần người dùng đã cố gắng nhập mã OTP.
// - maxAttempts: Số lần tối đa cho phép nhập mã OTP trước khi yêu cầu tạo lại mã mới.
// - isUsed: Trạng thái cho biết mã OTP đã được sử dụng hay chưa.
// - usedAt: Thời điểm mã OTP được sử dụng lần đầu tiên.
// - invalidatedAt: Thời điểm mã OTP bị vô hiệu hóa (do hết hạn hoặc vượt quá số lần nhập sai).
// - lastSentAt: Thời điểm mã OTP được gửi lần cuối cùng.
// - sendCount: Số lần mã OTP đã được gửi đến email mới.
// - requestIp: Địa chỉ IP của người dùng khi yêu cầu thay đổi email.
// - userAgent: Thông tin về trình duyệt hoặc thiết bị của người dùng khi yêu cầu thay đổi email.
const emailChangeVerificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    oldEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    newEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    pendingProfile: {
      displayName: {
        type: String,
        trim: true,
        default: null,
      },
      userName: {
        type: String,
        trim: true,
        lowercase: true,
        default: null,
      },
      phone: {
        type: String,
        default: null,
      },
      bio: {
        type: String,
        default: null,
      },
    },
    otpHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    isUsed: {
      type: Boolean,
      default: false,
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    invalidatedAt: {
      type: Date,
      default: null,
    },
    lastSentAt: {
      type: Date,
      default: Date.now,
    },
    sendCount: {
      type: Number,
      default: 1,
    },
    requestIp: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Thiết lập TTL index để tự động xóa các bản ghi sau 24 giờ kể từ khi được tạo
emailChangeVerificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 24 * 60 * 60 },
);

// Thiết lập compound index để tối ưu hóa truy vấn tìm kiếm theo userId và newEmail
export default mongoose.model(
  "EmailChangeVerification",
  emailChangeVerificationSchema,
);
