import mongoose from "mongoose";

const FRIEND_REQUEST_STATUSES = ["pending", "accepted", "rejected", "cancelled"];

const friendRequestSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    message: {
      type: String,
      maxlength: 300,
    },
    status: {
      type: String,
      enum: FRIEND_REQUEST_STATUSES,
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

friendRequestSchema.index({ from: 1, to: 1 }, { unique: true });

friendRequestSchema.index({ from: 1 });

friendRequestSchema.index({ to: 1 });

const FriendRequest = mongoose.model("FriendRequest", friendRequestSchema);

export { FRIEND_REQUEST_STATUSES };
export default FriendRequest;
