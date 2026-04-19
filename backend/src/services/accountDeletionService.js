import mongoose from "mongoose";

import Conversation from "../models/Conversation.js";
import Friend from "../models/Friend.js";
import FriendRequest from "../models/FriendRequest.js";
import Message from "../models/Message.js";
import Session from "../models/Session.js";
import User from "../models/User.js";
import {
  buildDeletedSenderSnapshot,
  buildLastMessagePayload,
} from "../utils/messageHelper.js";
import { disconnectUserSockets, emitToUser, getIo } from "../socket/index.js";

const ensureObjectId = (value) =>
  value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(value);

const toStringId = (value) => value?.toString?.() ?? String(value);

const createDeletionSummary = () => ({
  deletedDirectConversationsCount: 0,
  deletedDirectMessagesCount: 0,
  affectedGroupsCount: 0,
  anonymizedGroupMessagesCount: 0,
  deletedGroupsCount: 0,
  deletedFriendRequestsCount: 0,
  deletedFriendshipsCount: 0,
  deletedBlockRelationsCount: 0,
  deletedSessionsCount: 0,
});

const findLatestGroupMessage = async (conversationId) =>
  Message.findOne({ conversationId }).sort({ createdAt: -1 });

const syncGroupLastMessageSnapshot = async (conversation) => {
  const latestMessage = await findLatestGroupMessage(conversation._id);

  conversation.lastMessageAt = latestMessage?.createdAt ?? null;
  conversation.lastMessage = latestMessage
    ? buildLastMessagePayload(latestMessage)
    : null;
};

const anonymizeGroupMessages = async (conversationId, userId) => {
  const deletedSender = buildDeletedSenderSnapshot();

  const anonymizedMessagesResult = await Message.updateMany(
    { conversationId, senderId: userId },
    {
      $set: {
        senderId: null,
        senderDeleted: true,
        senderDisplayName: deletedSender.senderDisplayName,
        senderAvatar: deletedSender.senderAvatar,
      },
      $pull: {
        deletedFor: userId,
      },
    },
  );

  await Message.updateMany(
    { conversationId, "replyTo.senderId": userId },
    {
      $set: {
        "replyTo.senderId": null,
        "replyTo.senderDeleted": true,
        "replyTo.senderDisplayName": deletedSender.senderDisplayName,
        "replyTo.senderAvatar": deletedSender.senderAvatar,
      },
    },
  );

  await Message.updateMany(
    { conversationId, deletedFor: userId },
    {
      $pull: {
        deletedFor: userId,
      },
    },
  );

  await Message.updateMany(
    { conversationId, "reactions.userIds": userId },
    {
      $pull: {
        "reactions.$[].userIds": userId,
      },
    },
  );

  return anonymizedMessagesResult.modifiedCount ?? 0;
};

const buildConversationUpdatePayload = (conversation) => ({
  _id: conversation._id.toString(),
  type: conversation.type,
  group: conversation.group ?? null,
  participants: (conversation.participants || []).map((participant) => ({
    _id: participant.userId?.toString?.() ?? participant.userId,
    joinedAt: participant.joinedAt,
  })),
  unreadCounts: Object.fromEntries(conversation.unreadCounts || []),
  seenBy: (conversation.seenBy || []).map((item) => item.toString()),
  lastMessage: conversation.lastMessage,
  lastMessageAt: conversation.lastMessageAt,
});

export const permanentlyDeleteUserAccount = async ({
  targetUserId,
  actorUserId = null,
  initiatedBy = "self",
}) => {
  const userId = ensureObjectId(targetUserId);
  const userIdString = userId.toString();
  const summary = createDeletionSummary();

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("Người dùng không tồn tại.");
    error.status = 404;
    throw error;
  }

  const directConversations = await Conversation.find({
    type: "direct",
    "participants.userId": userId,
  }).select("_id participants");
  const groupConversations = await Conversation.find({
    type: "group",
    "participants.userId": userId,
  });

  const directConversationIds = directConversations.map((conversation) => conversation._id);

  const [friendRequestResult, friendshipResult, inboundBlockResult] =
    await Promise.all([
      FriendRequest.deleteMany({
        $or: [{ from: userId }, { to: userId }],
      }),
      Friend.deleteMany({
        $or: [{ userA: userId }, { userB: userId }],
      }),
      User.updateMany(
        { "blockedUsers.userId": userId },
        {
          $pull: { blockedUsers: { userId } },
        },
      ),
    ]);

  summary.deletedFriendRequestsCount = friendRequestResult.deletedCount ?? 0;
  summary.deletedFriendshipsCount = friendshipResult.deletedCount ?? 0;
  summary.deletedBlockRelationsCount =
    (user.blockedUsers?.length ?? 0) + (inboundBlockResult.modifiedCount ?? 0);

  if (directConversationIds.length > 0) {
    const directMessagesResult = await Message.deleteMany({
      conversationId: { $in: directConversationIds },
    });
    const directConversationResult = await Conversation.deleteMany({
      _id: { $in: directConversationIds },
    });

    summary.deletedDirectMessagesCount = directMessagesResult.deletedCount ?? 0;
    summary.deletedDirectConversationsCount =
      directConversationResult.deletedCount ?? 0;

    const io = getIo();

    directConversations.forEach((conversation) => {
      const otherParticipantIds = (conversation.participants || [])
        .map((participant) => toStringId(participant.userId))
        .filter((participantId) => participantId !== userIdString);

      otherParticipantIds.forEach((participantId) => {
        emitToUser(participantId, "conversation:deleted", {
          conversationId: conversation._id.toString(),
          deletedByUserId: userIdString,
        });
      });

      io.to(conversation._id.toString()).emit("conversation:deleted", {
        conversationId: conversation._id.toString(),
        deletedByUserId: userIdString,
      });
    });
  }

  for (const conversation of groupConversations) {
    summary.affectedGroupsCount += 1;

    conversation.participants = (conversation.participants || []).filter(
      (participant) => participant.userId.toString() !== userIdString,
    );
    conversation.seenBy = (conversation.seenBy || []).filter(
      (seenUserId) => seenUserId.toString() !== userIdString,
    );
    conversation.clearedFor = (conversation.clearedFor || []).filter(
      (entry) => entry.userId.toString() !== userIdString,
    );
    conversation.unreadCounts?.delete?.(userIdString);

    summary.anonymizedGroupMessagesCount += await anonymizeGroupMessages(
      conversation._id,
      userId,
    );

    const remainingMemberIds = (conversation.participants || []).map((participant) =>
      toStringId(participant.userId),
    );

    if (conversation.group?.createdBy?.toString() === userIdString) {
      conversation.group.createdBy =
        remainingMemberIds.length > 0 ? remainingMemberIds[0] : null;
    }

    if (remainingMemberIds.length === 0) {
      await Message.deleteMany({ conversationId: conversation._id });
      await Conversation.deleteOne({ _id: conversation._id });
      summary.deletedGroupsCount += 1;

      getIo().to(conversation._id.toString()).emit("conversation:deleted", {
        conversationId: conversation._id.toString(),
        deletedByUserId: userIdString,
      });
      continue;
    }

    await syncGroupLastMessageSnapshot(conversation);
    await conversation.save();

    const conversationPayload = buildConversationUpdatePayload(conversation);
    const io = getIo();

    remainingMemberIds.forEach((memberId) => {
      emitToUser(memberId, "conversation:updated", {
        conversation: conversationPayload,
      });
      emitToUser(memberId, "conversation:member-removed", {
        conversationId: conversation._id.toString(),
        memberId: userIdString,
        deletedAccount: true,
        participantsCount: remainingMemberIds.length,
      });
    });

    io.to(conversation._id.toString()).emit("message:bulk-updated", {
      conversationId: conversation._id.toString(),
      reason: "user-account-deleted",
      userId: userIdString,
    });
  }

  const deletedSessionsResult = await Session.deleteMany({ userId });
  summary.deletedSessionsCount = deletedSessionsResult.deletedCount ?? 0;

  emitToUser(userIdString, "account:deleted", {
    userId: userIdString,
    initiatedBy,
    actorUserId: actorUserId ? actorUserId.toString() : null,
  });
  disconnectUserSockets(userIdString);

  await User.findByIdAndDelete(userId);

  return {
    user,
    summary,
  };
};
