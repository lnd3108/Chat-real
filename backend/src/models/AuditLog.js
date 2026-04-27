import mongoose from "mongoose";

// Mô hình dữ liệu cho việc ghi lại lịch sử các hành động quan trọng liên quan đến người dùng,
// bao gồm thông tin về người thực hiện hành động, người bị ảnh hưởng, loại hành động, 
// dữ liệu trước và sau khi thay đổi, lý do và metadata bổ sung.
const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorRoles: {
      type: [String],
      default: [],
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    beforeData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    afterData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;
