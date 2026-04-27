import Conversation from "../../../models/Conversation.js";
import Message from "../../../models/Message.js";
import {
  buildDirectBlockInfo,
} from "../domain/direct-blocking.policy.js";

// Hàm gọi xóa 
export const getClearedAtForUser = (conversation, userId) => {
  const currentUserId = userId?.toString();
  if (!currentUserId) return null;

  const clearedEntry = (conversation.clearedFor || []).find(
    (item) => item.userId?.toString() === currentUserId,
  );

  return clearedEntry?.clearedAt ? new Date(clearedEntry.clearedAt) : null;
};

export const normalizeMessageForUser = (message, userId) => {
  const currentUserId = userId?.toString();
  return {
    ...message.toObject(),
    senderId: message.senderId?.toString?.() ?? message.senderId ?? null,
    senderDeleted: Boolean(message.senderDeleted || !message.senderId),
    senderDisplayName: message.senderDisplayName ?? null,
    senderAvatar: message.senderAvatar ?? null,
    deletedFor: (message.deletedFor || []).map((item) => item.toString()),
    reactions: (message.reactions || []).map((reaction) => ({
      emoji: reaction.emoji,
      userIds: (reaction.userIds || []).map((item) => item.toString()),
    })),
    isHiddenForMe: (message.deletedFor || []).some(
      (item) => item.toString() === currentUserId,
    ),
  };
};

export const shouldIncludeConversationForUser = (conversation, userId) => {
  if (conversation.type !== "direct") return true;

  const clearedAt = getClearedAtForUser(conversation, userId);
  if (!clearedAt) return true;

  if (!conversation.lastMessageAt) return false;
  return new Date(conversation.lastMessageAt) > clearedAt;
};

export const attachBlockInfoToConversation = (conversation, viewerUser) => {
  if (!conversation || conversation.type !== "direct" || !viewerUser?._id) {
    return conversation;
  }

  const sanitizedParticipants = (conversation.participants || []).map((participant) => {
    const { blockedUsers, ...rest } = participant;
    return rest;
  });

  const otherParticipant = (conversation.participants || []).find(
    (participant) => participant._id?.toString() !== viewerUser._id.toString(),
  );

  if (!otherParticipant?._id) {
    return {
      ...conversation,
      participants: sanitizedParticipants,
    };
  }

  const otherBlockedUsers =
    otherParticipant.blockedUsers ??
    otherParticipant.userId?.blockedUsers ??
    [];

  return {
    ...conversation,
    participants: sanitizedParticipants,
    blockInfo: buildDirectBlockInfo({
      viewerId: viewerUser._id,
      otherUserId: otherParticipant._id,
      viewerUser,
      otherUser: { blockedUsers: otherBlockedUsers },
    }),
  };
};

export const getUserConversationIdsForRealtime = async (userId) => {
  try {
    const conversations = await Conversation.find(
      {
        "participants.userId": userId,
        $or: [
          { type: { $ne: "support" } },
          { type: "support", userDeletedAt: null },
        ],
      },
      { _id: 1 },
    );

    return conversations.map((conversation) => conversation._id.toString());
  } catch (error) {
    console.error("Loi khi fetch conversations realtime:", error);
    return [];
  }
};

export const getConversationListForUser = async (user) => {
  const userId = user._id;

  const conversations = await Conversation.find({
    "participants.userId": userId,
    $or: [
      { type: { $ne: "support" } },
      { type: "support", userDeletedAt: null },
    ],
  })
    .sort({ lastMessageAt: -1 })
    .populate({
      path: "participants.userId",
      select: "userName displayName avatarUrl bio blockedUsers",
    })
    .populate({
      path: "lastMessage.senderId",
      select: "displayName avatarUrl",
    })
    .populate({
      path: "seenBy",
      select: "displayName avatarUrl",
    });

  return conversations
    .filter((conversation) => shouldIncludeConversationForUser(conversation, userId))
    .map((conversation) => {
      const participants = (conversation.participants || []).map((participant) => ({
        _id: participant.userId?._id,
        userName: participant.userId?.userName,
        displayName: participant.userId?.displayName,
        avatarUrl: participant.userId?.avatarUrl ?? null,
        bio: participant.userId?.bio ?? null,
        blockedUsers: participant.userId?.blockedUsers ?? [],
        joinedAt: participant.joinedAt,
      }));

      return attachBlockInfoToConversation(
        {
          ...conversation.toObject(),
          unreadCounts: conversation.unreadCounts || {},
          participants,
        },
        user,
      );
    });
};

export const getConversationMessagesForUser = async ({
  user,
  conversationId,
  limit = 50,
  cursor,
}) => {
  const userId = user._id;

  const conversation = await Conversation.findById(conversationId).select(
    "_id participants clearedFor",
  );

  if (!conversation) {
    return { error: { status: 404, message: "Conversation khong ton tai" } };
  }

  const isMember = conversation.participants.some(
    (participant) => participant.userId.toString() === userId.toString(),
  );
  if (!isMember) {
    return { error: { status: 403, message: "Ban khong thuoc cuoc tro chuyen nay" } };
  }

  const query = {
    conversationId,
    deletedFor: { $ne: userId },
  };

  const clearedAt = getClearedAtForUser(conversation, userId);
  if (clearedAt) {
    query.createdAt = { $gt: clearedAt };
  }

  if (typeof cursor === "string" && cursor.trim() !== "") {
    const parsedCursor = new Date(cursor);
    if (!Number.isNaN(parsedCursor.getTime())) {
      query.createdAt = {
        ...(query.createdAt || {}),
        $lt: parsedCursor,
      };
    }
  }

  let messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit) + 1);

  let nextCursor = null;
  if (messages.length > Number(limit)) {
    const nextMessage = messages[messages.length - 1];
    nextCursor = nextMessage.createdAt.toISOString();
    messages.pop();
  }

  messages = messages.reverse();

  return {
    payload: {
      messages: messages.map((message) => normalizeMessageForUser(message, userId)),
      nextCursor,
    },
  };
};

export const getGroupDetailsForUser = async ({ user, conversationId }) => {
  const userId = user._id;
  const conversation = await Conversation.findById(conversationId).populate([
    { path: "participants.userId", select: "displayName avatarUrl email" },
    { path: "group.createdBy", select: "displayName avatarUrl" },
  ]);

  if (!conversation) {
    return { error: { status: 404, message: "Cuoc tro chuyen khong ton tai" } };
  }

  const isMember = conversation.participants.some(
    (participant) => participant.userId._id.toString() === userId.toString(),
  );
  if (!isMember) {
    return { error: { status: 403, message: "Ban khong thuoc cuoc tro chuyen nay" } };
  }

  const isOwner =
    conversation.group?.createdBy?._id?.toString() === userId.toString();

  return {
    payload: {
      group: {
        _id: conversation._id,
        name: conversation.group?.name,
        avatarUrl: conversation.group?.avatarUrl ?? null,
        createdBy: conversation.group?.createdBy,
        createdAt: conversation.createdAt,
        members: conversation.participants.map((participant) => ({
          _id: participant.userId._id,
          displayName: participant.userId.displayName,
          avatarUrl: participant.userId.avatarUrl,
          email: participant.userId.email,
          joinedAt: participant.joinedAt,
          isOwner:
            participant.userId._id.toString() === conversation.group.createdBy.toString(),
        })),
        isOwner,
        memberCount: conversation.participants.length,
      },
    },
  };
};
