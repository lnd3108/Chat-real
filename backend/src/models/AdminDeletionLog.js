import mongoose from "mongoose";

// Mô hình dữ liệu cho việc ghi lại lịch sử xóa tài khoản người dùng bởi admin,
// bao gồm thông tin về người dùng bị xóa, admin thực hiện xóa, thời gian xóa, lý do xóa và tóm tắt các dữ liệu đã được dọn dẹp.
const adminDeletionLogSchema = new mongoose.Schema(
  {
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    usernameSnapshot: {
      type: String,
      required: true,
      trim: true,
    },
    displayNameSnapshot: {
      type: String,
      required: true,
      trim: true,
    },
    deletedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deletedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      trim: true,
      default: null,
    },
    cleanupSummary: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

adminDeletionLogSchema.index({ deletedByAdminId: 1, deletedAt: -1 });
adminDeletionLogSchema.index({ targetUserId: 1, deletedAt: -1 });

const AdminDeletionLog = mongoose.model(
  "AdminDeletionLog",
  adminDeletionLogSchema,
);

export default AdminDeletionLog;
