import mongoose from "mongoose";

// Bản ghi OTP cho việc đặt lại mật khẩu, 
// có thể được sử dụng để xác thực người dùng trước khi 
// cho phép họ đặt lại mật khẩu của mình. Bản ghi này 
// sẽ chứa thông tin về OTP đã được tạo, thời gian hết hạn, số lần thử, và trạng thái sử dụng của OTP đó.
const passwordResetOtpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
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
    requestIp: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    resetTokenHash: {
      type: String,
      default: null,
    },
    resetTokenExpiresAt: {
      type: Date,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Thiết lập TTL index để tự động xóa các bản ghi OTP sau 24 giờ
passwordResetOtpSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 24 * 60 * 60 },
);

// Thiết lập compound index để tối ưu hóa truy vấn tìm kiếm OTP theo email và trạng thái sử dụng
export default mongoose.model("PasswordResetOtp", passwordResetOtpSchema);
