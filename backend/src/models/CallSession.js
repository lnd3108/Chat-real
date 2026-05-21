import mongoose from "mongoose";

export const CALL_SESSION_STATUSES = {
  RINGING: "ringing",
  ACTIVE: "active",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  MISSED: "missed",
  CANCELLED: "cancelled",
  ENDED: "ended",
  FAILED: "failed",
};

export const CALL_SESSION_TYPES = {
  VOICE: "voice",
  VIDEO: "video",
};

export const CALL_SESSION_MODES = {
  DIRECT: "direct",
  GROUP: "group",
};

export const CALL_PARTICIPANT_STATUSES = {
  INVITED: "invited",
  RINGING: "ringing",
  JOINED: "joined",
  DECLINED: "declined",
  MISSED: "missed",
  LEFT: "left",
};

const callParticipantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CALL_PARTICIPANT_STATUSES),
      default: CALL_PARTICIPANT_STATUSES.INVITED,
      required: true,
    },
    invitedAt: {
      type: Date,
      default: null,
    },
    joinedAt: {
      type: Date,
      default: null,
    },
    leftAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

const callSessionSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    callerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required() {
        return this.callMode !== CALL_SESSION_MODES.GROUP;
      },
      index: true,
    },
    initiatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    callMode: {
      type: String,
      enum: Object.values(CALL_SESSION_MODES),
      default: CALL_SESSION_MODES.DIRECT,
      required: true,
      index: true,
    },
    callType: {
      type: String,
      enum: Object.values(CALL_SESSION_TYPES),
      default: CALL_SESSION_TYPES.VOICE,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(CALL_SESSION_STATUSES),
      required: true,
      default: CALL_SESSION_STATUSES.RINGING,
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    endReason: {
      type: String,
      default: null,
      trim: true,
    },
    participants: {
      type: [callParticipantSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

callSessionSchema.index({ callerId: 1, status: 1 });
callSessionSchema.index({ receiverId: 1, status: 1 });
callSessionSchema.index({ conversationId: 1, callMode: 1, status: 1 });
callSessionSchema.index({ "participants.userId": 1, status: 1 });

const CallSession = mongoose.model("CallSession", callSessionSchema);

export default CallSession;
