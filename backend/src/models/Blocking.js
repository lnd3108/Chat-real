import mongoose from "mongoose";

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
  },
  {
    timestamps: true,
  }
);

blockingSchema.index({ userId: 1, blockedUserId: 1 }, { unique: true });

const Blocking = mongoose.model("Blocking", blockingSchema);

export default Blocking;
