import mongoose from "mongoose";

export const CALL_SESSION_STATUSES = {
  RINGING: "ringing",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  MISSED: "missed",
  CANCELLED: "cancelled",
  ENDED: "ended",
  FAILED: "failed",
};

const callSessionSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    callerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(CALL_SESSION_STATUSES),
      required: true,
      default: CALL_SESSION_STATUSES.RINGING,
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    endReason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

callSessionSchema.index({ callerId: 1, status: 1 });
callSessionSchema.index({ receiverId: 1, status: 1 });

const CallSession = mongoose.model("CallSession", callSessionSchema);

export default CallSession;
