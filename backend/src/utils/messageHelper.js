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
) => {
  const lastMessage = buildLastMessagePayload(message, senderId);

  conversation.set({
    seenBy: [],
    lastMessageAt: message.createdAt,
    lastMessage,
  });

  conversation.participants.forEach((p) => {
    const memberId = p.userId.toString();
    const isSender = memberId === senderId.toString();
    const prevCount = conversation.unreadCounts.get(memberId) || 0;
    conversation.unreadCounts.set(memberId, isSender ? 0 : prevCount + 1);
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
      },
    unreadCounts: conversation.unreadCounts,
  };

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
