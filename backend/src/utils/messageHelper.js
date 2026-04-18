import { emitToUser } from "../socket/index.js";

export const buildLastMessagePayload = (message, senderIdOverride) => {
  const senderId = senderIdOverride ?? message.senderId;
  const lastMessageContent = message.isDeletedForEveryone
    ? "Bạn đã xóa một tin nhắn"
    : message.content?.trim() || (message.imgUrl ? "[Hình ảnh]" : null);

  return {
    _id: message._id,
    content: lastMessageContent,
    imgUrl: message.isDeletedForEveryone ? null : (message.imgUrl ?? null),
    isDeletedForEveryone: Boolean(message.isDeletedForEveryone),
    senderId,
    createdAt: message.createdAt,
  };
};

export const updateConversationAfterCreateMessage = (
  conversation,
  message,
  senderId,
  options = {},
) => {
  const lastMessage = buildLastMessagePayload(message, senderId);
  const activeSeenBy = [];
  const isConversationActive = options.isConversationActive ?? (() => false);

  conversation.set({
    lastMessageAt: message.createdAt,
    lastMessage,
  });

  conversation.participants.forEach((participant) => {
    const memberId = participant.userId.toString();
    const isSender = memberId === senderId.toString();

    if (isSender) {
      conversation.unreadCounts.set(memberId, 0);
      return;
    }

    if (isConversationActive(memberId)) {
      conversation.unreadCounts.set(memberId, 0);
      activeSeenBy.push(participant.userId);
      return;
    }

    const prevCount = conversation.unreadCounts.get(memberId) || 0;
    conversation.unreadCounts.set(memberId, prevCount + 1);
  });

  conversation.set({
    seenBy: activeSeenBy,
  });
};

export const syncConversationLastMessage = (conversation, message) => {
  conversation.set({
    lastMessageAt: message?.createdAt ?? null,
    lastMessage: message ? buildLastMessagePayload(message) : null,
  });
};

export const emitNewMessage = (io, conversation, message, conversationPayload) => {
  const payload = {
    message,
    conversation:
      conversationPayload ?? {
        _id: conversation._id,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        seenBy: conversation.seenBy,
      },
    unreadCounts: conversation.unreadCounts,
  };

  if (conversationPayload && Array.isArray(conversation.participants)) {
    conversation.participants.forEach((participant) => {
      const participantId =
        participant?.userId?.toString?.() ?? participant?.userId ?? null;

      if (participantId) {
        emitToUser(participantId.toString(), "new-message", payload);
      }
    });
    return;
  }

  io.to(conversation._id.toString()).emit("new-message", payload);
};

export const emitMessageUpdated = (io, conversation, message) => {
  io.to(conversation._id.toString()).emit("message:updated", {
    message,
    conversation: {
      _id: conversation._id,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
      seenBy: conversation.seenBy,
      unreadCounts: conversation.unreadCounts,
    },
  });
};
