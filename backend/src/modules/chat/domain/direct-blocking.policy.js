import Conversation from "../../../models/Conversation.js";

const toIdString = (value) => {
  if (!value) return "";
  return value.toString ? value.toString() : String(value);
};

const readBlockedEntries = (user) => {
  if (!user?.blockedUsers) return [];
  return Array.isArray(user.blockedUsers) ? user.blockedUsers : [];
};

export const isUserBlockedBy = (user, targetUserId) =>
  readBlockedEntries(user).some(
    (entry) => toIdString(entry.userId) === toIdString(targetUserId),
  );

export const getBlockEntry = (user, targetUserId) =>
  readBlockedEntries(user).find(
    (entry) => toIdString(entry.userId) === toIdString(targetUserId),
  ) ?? null;

export const buildDirectBlockInfo = ({
  viewerId,
  otherUserId,
  viewerUser,
  otherUser,
}) => {
  const blockedByMe = isUserBlockedBy(viewerUser, otherUserId);
  const blockedByOther = isUserBlockedBy(otherUser, viewerId);

  return {
    blockedByMe,
    blockedByOther,
    blockerId: blockedByMe
      ? toIdString(viewerId)
      : blockedByOther
        ? toIdString(otherUserId)
        : null,
    blockedUserId: blockedByMe
      ? toIdString(otherUserId)
      : blockedByOther
        ? toIdString(viewerId)
        : null,
    canSendMessage: !blockedByMe && !blockedByOther,
  };
};

export const ensureDirectMessagingAllowed = ({
  senderUser,
  recipientUser,
  senderId,
  recipientId,
}) => {
  const senderBlockedRecipient = isUserBlockedBy(senderUser, recipientId);
  if (senderBlockedRecipient) {
    return {
      allowed: false,
      status: 403,
      message:
        "Ban da chan nguoi dung nay. Ban khong the nhan tin cho ho trong cuoc tro chuyen nay.",
      code: "DIRECT_BLOCKED_BY_SENDER",
    };
  }

  const recipientBlockedSender = isUserBlockedBy(recipientUser, senderId);
  if (recipientBlockedSender) {
    return {
      allowed: false,
      status: 403,
      message: "Ban hien khong the nhan tin cho tai khoan nay.",
      code: "DIRECT_BLOCKED_BY_RECIPIENT",
    };
  }

  return { allowed: true };
};

export const findDirectConversationBetweenUsers = async (userAId, userBId) =>
  Conversation.findOne({
    type: "direct",
    "participants.userId": {
      $all: [userAId, userBId],
    },
  }).select("_id participants type");

export const getDirectConversationOtherParticipantId = (conversation, userId) => {
  if (!conversation || conversation.type !== "direct") return "";

  const otherParticipant = (conversation.participants || []).find(
    (participant) => toIdString(participant.userId) !== toIdString(userId),
  );

  return toIdString(otherParticipant?.userId);
};
