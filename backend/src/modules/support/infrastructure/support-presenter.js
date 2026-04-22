export const populateSupportConversation = async (conversation) => {
  await conversation.populate([
    {
      path: "participants.userId",
      select: "displayName userName avatarUrl role email",
    },
    {
      path: "supportCreatedByUserId",
      select: "displayName userName avatarUrl email role",
    },
    {
      path: "assignedAdminId",
      select: "displayName userName avatarUrl email role",
    },
  ]);

  return conversation;
};

const formatSupportParticipants = (participants = []) =>
  participants.map((participant) => ({
    _id: participant.userId?._id ?? participant.userId ?? null,
    userName: participant.userId?.userName ?? null,
    displayName: participant.userId?.displayName ?? null,
    avatarUrl: participant.userId?.avatarUrl ?? null,
    role: participant.userId?.role ?? null,
    email: participant.userId?.email ?? null,
    joinedAt: participant.joinedAt,
  }));

const toPlainUnreadCounts = (unreadCounts) =>
  unreadCounts instanceof Map ? Object.fromEntries(unreadCounts) : unreadCounts || {};

export const formatSupportConversation = (conversation) => {
  const plainConversation =
    typeof conversation.toObject === "function" ? conversation.toObject() : conversation;

  return {
    ...plainConversation,
    participants: formatSupportParticipants(plainConversation.participants),
    supportCreatedByUser:
      plainConversation.supportCreatedByUserId &&
      typeof plainConversation.supportCreatedByUserId === "object"
        ? plainConversation.supportCreatedByUserId
        : null,
    assignedAdmin:
      plainConversation.assignedAdminId && typeof plainConversation.assignedAdminId === "object"
        ? plainConversation.assignedAdminId
        : null,
    unreadCounts: toPlainUnreadCounts(plainConversation.unreadCounts),
  };
};

export const buildSupportConversationSocketPayload = (conversation) => ({
  _id: conversation._id,
  type: "support",
  participants: conversation.participants,
  supportStatus: conversation.supportStatus,
  supportCreatedByUserId:
    conversation.supportCreatedByUser?._id ??
    conversation.supportCreatedByUserId?._id ??
    conversation.supportCreatedByUserId,
  supportCreatedByUser: conversation.supportCreatedByUser ?? null,
  assignedAdminId:
    conversation.assignedAdmin?._id ??
    conversation.assignedAdminId?._id ??
    conversation.assignedAdminId ??
    null,
  assignedAdmin: conversation.assignedAdmin ?? null,
  lastMessage: conversation.lastMessage ?? null,
  lastMessageAt: conversation.lastMessageAt ?? conversation.updatedAt,
  unreadCounts: conversation.unreadCounts ?? {},
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});
