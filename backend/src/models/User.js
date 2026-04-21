import mongoose from "mongoose";
import { APP_ROLES } from "../constants/rbac.js";

const userSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    hashedPassword: {
      type: String,
      required: true,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    emailVerified: {
      type: Boolean,
      default: true,
    },
    emailVerificationCodeHash: {
      type: String,
    },
    emailVerificationExpiresAt: {
      type: Date,
    },
    emailVerificationLastSentAt: {
      type: Date,
    },
    accountDeletionCodeHash: {
      type: String,
    },
    accountDeletionExpiresAt: {
      type: Date,
    },
    accountDeletionLastSentAt: {
      type: Date,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(APP_ROLES),
      default: APP_ROLES.USER,
    },
    roles: {
      type: [String],
      default: [],
    },
    permissions: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "banned"],
      default: "active",
    },
    isSystemAccount: {
      type: Boolean,
      default: false,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    avatarUrl: {
      type: String,
    },
    avatarId: {
      type: String,
    },
    bio: {
      type: String,
      maxlength: 500,
    },
    phone: {
      type: String,
      sparse: true,
    },
    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system",
      },
      showOnlineStatus: {
        type: Boolean,
        default: true,
      },
    },
    blockedUsers: {
      type: [
        new mongoose.Schema(
          {
            userId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            reason: {
              type: String,
              trim: true,
              default: null,
            },
            createdAt: {
              type: Date,
              default: Date.now,
            },
          },
          {
            _id: false,
          },
        ),
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model("User", userSchema);
export default User;
