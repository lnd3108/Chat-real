import mongoose from "mongoose";

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

emailChangeVerificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 24 * 60 * 60 },
);

export default mongoose.model(
  "EmailChangeVerification",
  emailChangeVerificationSchema,
);
