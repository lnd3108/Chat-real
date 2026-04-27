import mongoose from "mongoose";

// Schema cho người tham gia trong cuộc trò chuyện, bao gồm ID người dùng và thời gian tham gia
const participantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

// Schema cho thông tin nhóm trong cuộc trò chuyện nhóm
const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    avatarId: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    _id: false,
  }
);

// Schema để theo dõi trạng thái đã xóa của người dùng trong cuộc trò chuyện
const clearedStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clearedAt: {
      type: Date,
      required: true,
    },
  },
  {
    _id: false,
  }
);

// Schema cho tin nhắn cuối cùng trong cuộc trò chuyện, bao gồm nội dung, người gửi và thời gian tạo
const lastMessageSchema = new mongoose.Schema(
  {
    _id: { type: String },
    content: {
      type: String,
      default: null,
    },
    imgUrl: {
      type: String,
      default: null,
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
    createdAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

// Schema chính cho Conversation, bao gồm loại cuộc trò chuyện, 
// người tham gia, thông tin nhóm (nếu là cuộc trò chuyện nhóm), 
// trạng thái tin nhắn cuối cùng, số lượng 
// tin nhắn chưa đọc và các trường liên quan đến hỗ trợ khách hàng.
const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["direct", "group", "support"],
      required: true,
    },

    participants: {
      type: [participantSchema],
      required: true,
    },
    group: {
      type: groupSchema,
    },

    lastMessageAt: {
      type: Date,
    },
    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    lastMessage: {
      type: lastMessageSchema,
      default: null,
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    clearedFor: {
      type: [clearedStateSchema],
      default: [],
    },

    // Support-specific fields
    supportStatus: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
      sparse: true,
    },
    supportCreatedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      sparse: true,
    },
    assignedAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      sparse: true,
    },
    userDeletedAt: {
      type: Date,
      default: null,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index để tối ưu hóa truy vấn cho các cuộc trò chuyện trực tiếp và nhóm, dựa trên ID người tham gia và thời gian tin nhắn cuối cùng
conversationSchema.index({
  "participants.userId": 1,
  lastMessageAt: -1,
});

// Support conversation indexes
conversationSchema.index({
  type: 1,
  supportStatus: 1,
  lastMessageAt: -1,
});

// Index để tối ưu hóa truy vấn cho các cuộc trò chuyện hỗ trợ, dựa trên người tạo và loại cuộc trò chuyện
conversationSchema.index({
  supportCreatedByUserId: 1,
  type: 1,
});

// Index để tối ưu hóa truy vấn cho các cuộc trò chuyện hỗ trợ, dựa trên người được giao và trạng thái hỗ trợ
conversationSchema.index({
  assignedAdminId: 1,
  supportStatus: 1,
});

// Index để tối ưu hóa truy vấn cho các cuộc trò chuyện hỗ trợ, dựa trên trạng thái đã xóa của người dùng
const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
