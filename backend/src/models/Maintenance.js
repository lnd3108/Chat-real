import mongoose from "mongoose";

const maintenanceSchema = new mongoose.Schema(
  {
    isEnabled: {
      type: Boolean,
      default: false,
      required: true,
    },
    message: {
      type: String,
      default:
        "Hệ thống đang bảo trì, hãy quay lại sau 1 tiếng nữa nhé, rất xin lỗi vì sự làm phiền này nhưng chúng tôi cần bảo trì để nâng cao trải nghiệm của bạn.",
    },
    // Two-factor confirmation state
    confirmationCodeHash: {
      type: String,
    },
    confirmationExpiresAt: {
      type: Date,
    },
    confirmationAttempts: {
      type: Number,
      default: 0,
    },
    lastConfirmationAttemptAt: {
      type: Date,
    },
    passwordVerificationHash: {
      type: String,
    },
    passwordVerificationExpiresAt: {
      type: Date,
    },
    // Audit log
    enabledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    enabledAt: {
      type: Date,
    },
    disabledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    disabledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Maintenance", maintenanceSchema);
