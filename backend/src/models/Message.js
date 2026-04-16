import mongoose from "mongoose";

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
    content: {
      type: String,
      default: null,
    },
    imgUrl: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: ["user", "system"],
      default: "user",
    },
  },
  { _id: false },
);

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
      required: true,
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

messageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
