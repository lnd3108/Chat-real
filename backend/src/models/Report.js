import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["user", "message", "conversation"],
      required: true,
      index: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    targetMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      index: true,
      default: null,
    },
    targetConversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      index: true,
      default: null,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["pending", "reviewing", "resolved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    resolutionNote: {
      type: String,
      default: null,
      maxlength: 2000,
    },
    // Snapshots to prevent issues if original data is deleted
    reporterSnapshot: {
      _id: mongoose.Schema.Types.ObjectId,
      displayName: String,
      userName: String,
      avatarUrl: String,
    },
    targetUserSnapshot: {
      _id: mongoose.Schema.Types.ObjectId,
      displayName: String,
      userName: String,
      email: String,
      avatarUrl: String,
    },
    targetMessagePreview: {
      _id: mongoose.Schema.Types.ObjectId,
      content: String,
      imgUrl: String,
      senderDisplayName: String,
      senderUserName: String,
      createdAt: Date,
    },
    targetConversationSnapshot: {
      _id: mongoose.Schema.Types.ObjectId,
      type: String,
      groupName: String,
      membersCount: Number,
    },
  },
  { timestamps: true },
);

// Compound index for efficient querying
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reporterId: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, status: 1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;
