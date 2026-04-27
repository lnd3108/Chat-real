import mongoose from "mongoose";

// Blocking types
const BLOCKING_TYPE_DIRECT_ONLY = "direct-only";

// Bản thiết kế cho mô hình Blocking, lưu trữ thông tin 
// về việc người dùng chặn người khác, lý do, trạng thái và thời gian chặn.
const blockingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    blockedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    unblockedAt: {
      type: Date,
      default: null,
    },
    type: {
      type: String,
      enum: [BLOCKING_TYPE_DIRECT_ONLY],
      default: BLOCKING_TYPE_DIRECT_ONLY,
    },
  },
  {
    timestamps: true,
  }
);

blockingSchema.index({ userId: 1, blockedUserId: 1 }, { unique: true });
blockingSchema.index({ isActive: 1, createdAt: -1 });

const Blocking = mongoose.model("Blocking", blockingSchema);

export { BLOCKING_TYPE_DIRECT_ONLY };
export default Blocking;
