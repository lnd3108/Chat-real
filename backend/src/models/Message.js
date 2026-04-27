import mongoose from "mongoose";

// Bản schema phụ để lưu thông tin của tin nhắn gốc khi trả lời, 
// giúp tránh việc phải truy vấn thêm khi hiển thị tin nhắn trả lời
const replyToSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    senderDeleted: {
      type: Boolean,
      default: false,
    },
    senderDisplayName: {
      type: String,
      default: null,
    },
    senderAvatar: {
      type: String,
      default: null,
    },
    content: {
      type: String,
      default: null,
    },
    imgUrl: {
      type: String,
      default: null,
    },
    isDeletedForEveryone: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ["user", "system"],
      default: "user",
    },
  },
  { _id: false },
);

// Bản schema phụ để lưu thông tin phản ứng của người dùng với tin nhắn
const reactionSchema = new mongoose.Schema(
  {
    emoji: {
      type: String,
      required: true,
      trim: true,
    },
    userIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { _id: false },
);

// Schema chính cho tin nhắn, bao gồm các trường cơ bản và các trường phụ để lưu thông tin trả lời và phản ứng
const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    senderDeleted: {
      type: Boolean,
      default: false,
    },
    senderDisplayName: {
      type: String,
      default: null,
    },
    senderAvatar: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: ["user", "system"],
      default: "user",
    },
    content: {
      type: String,
      trim: true,
    },
    imgUrl: {
      type: String,
    },
    imgPublicId: {
      type: String,
      default: null,
    },
    replyTo: {
      type: replyToSchema,
      default: null,
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isDeletedForEveryone: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Tạo index để tối ưu hóa truy vấn theo conversationId và sắp xếp theo createdAt giảm dần
messageSchema.index({ conversationId: 1, createdAt: -1 });

// Tạo model từ schema và xuất ra để sử dụng trong các phần khác của ứng dụng
const Message = mongoose.model("Message", messageSchema);

export default Message;
