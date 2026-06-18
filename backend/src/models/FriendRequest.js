import mongoose from "mongoose";

// Trạng thái của yêu cầu kết bạn
const FRIEND_REQUEST_STATUSES = ["pending", "accepted", "rejected", "cancelled"];

// Định nghĩa schema cho yêu cầu kết bạn
const friendRequestSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    message: {
      type: String,
      maxlength: 300,
    },
    status: {
      type: String,
      enum: FRIEND_REQUEST_STATUSES,
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Đảm bảo rằng một người dùng không thể gửi nhiều yêu cầu kết bạn đến cùng một người dùng khác
friendRequestSchema.index({ from: 1, to: 1 }, { unique: true });
// Tạo index để tối ưu hóa truy vấn theo người gửi và người nhận
friendRequestSchema.index({ from: 1 });
// Tạo index để tối ưu hóa truy vấn theo người nhận
friendRequestSchema.index({ to: 1 });
friendRequestSchema.index({ from: 1, status: 1, createdAt: -1 });
friendRequestSchema.index({ to: 1, status: 1, createdAt: -1 });
friendRequestSchema.index({ status: 1, createdAt: -1 });
// Tạo model từ schema
const FriendRequest = mongoose.model("FriendRequest", friendRequestSchema);
// Xuất model và các hằng số liên quan
export { FRIEND_REQUEST_STATUSES };
export default FriendRequest;
