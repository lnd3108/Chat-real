import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    refreshToken: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Thiết lập TTL index để tự động xóa các phiên làm việc sau khi hết hạn
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Mô hình dữ liệu cho phiên làm việc của người dùng, lưu trữ thông tin về token làm mới và thời gian hết hạn của phiên làm việc đó. Điều này giúp quản lý phiên làm việc hiệu quả và đảm bảo an toàn cho hệ thống.
export default mongoose.model("Session", sessionSchema);
