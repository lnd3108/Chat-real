import mongoose from "mongoose";

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
  },
  {
    timestamps: true,
  }
);

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

conversationSchema.index({
  supportCreatedByUserId: 1,
  type: 1,
});

conversationSchema.index({
  assignedAdminId: 1,
  supportStatus: 1,
});

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
