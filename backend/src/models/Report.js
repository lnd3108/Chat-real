import mongoose from "mongoose";

// Mô hình dữ liệu cho báo cáo vi phạm, cho phép người dùng báo cáo các hành vi không phù hợp hoặc vi phạm trong hệ thống.
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
    // Snapshot thông tin người báo cáo và đối tượng bị báo cáo tại thời điểm tạo báo cáo, để đảm bảo tính toàn vẹn của dữ liệu khi các thông tin này có thể thay đổi sau đó.
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

// Thiết lập các index để tối ưu hóa hiệu suất truy vấn báo cáo theo trạng thái, người báo cáo, và loại đối tượng bị báo cáo.
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reporterId: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, status: 1 });

// Mô hình dữ liệu cho báo cáo vi phạm, cho phép người dùng báo cáo các hành vi không phù hợp hoặc vi phạm trong hệ thống.
const Report = mongoose.model("Report", reportSchema);

export default Report;
