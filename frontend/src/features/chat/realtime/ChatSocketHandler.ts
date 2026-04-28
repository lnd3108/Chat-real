import { getParticipantId, getParticipantProfile } from "@/features/chat/lib/chatParticipants";
import {
  notifyIncomingMessage,
  shouldStoreNotification,
} from "@/features/notification/lib/messageNotifications";
import { playSound } from "@/features/settings/lib/sound";
import type { DirectBlockInfo, Participant } from "@/shared/types/chat";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import { useNotificationStore } from "@/features/notification/stores/useNotificationStore";

const isDocumentVisible = () =>
  typeof document !== "undefined" &&
  document.visibilityState === "visible" &&
  document.hasFocus();

const mergeDirectBlockInfo = (
  current: DirectBlockInfo | undefined = {
    blockedByMe: false,
    blockedByOther: false,
    blockerId: null,
    blockedUserId: null,
    canSendMessage: true,
  },
  meId: string | undefined,
  payload: {
    blockerId: string;
    blockedUserId: string;
    isBlocked: boolean;
  },
) => {
  const nextBlockedByMe =
    payload.blockerId === meId ? payload.isBlocked : current.blockedByMe;
  const nextBlockedByOther =
    payload.blockedUserId === meId ? payload.isBlocked : current.blockedByOther;

  return {
    blockedByMe: nextBlockedByMe,
    blockedByOther: nextBlockedByOther,
    blockerId:
      nextBlockedByMe
        ? meId ?? payload.blockerId
        : nextBlockedByOther
          ? payload.blockerId
          : null,
    blockedUserId:
      nextBlockedByMe
        ? payload.blockedUserId
        : nextBlockedByOther
          ? meId ?? payload.blockedUserId
          : null,
    canSendMessage: !nextBlockedByMe && !nextBlockedByOther,
  };
};

interface ChatSocketHandlerOptions {
  getShowOnlineStatus: () => boolean;
  setOnlineUsers: (userIds: string[]) => void;
}

export const registerChatSocketHandler = (
  socket: Socket,
  options: ChatSocketHandlerOptions,
) => {
  const onConnect = () => {
    socket.emit("preferences:showOnlineStatus", options.getShowOnlineStatus());
    socket.emit(
      "conversation:active",
      isDocumentVisible() ? useChatStore.getState().activeConversationId : null,
    );
  };

  const onOnlineUsers = (userIds: string[]) => {
    options.setOnlineUsers(userIds);
  };

  const onNewMessage = ({ message, conversation, unreadCounts }: any) => {
    const {
      addConvo,
      addMessage,
      activeConversationId,
      conversations,
      fetchConversations,
      fetchMessages,
      markasSeen,
      messages,
      setActiveConversation,
      updateConversation,
    } = useChatStore.getState();
    const { user } = useAuthStore.getState();
    const targetConversationId = conversation?._id ?? message.conversationId;
    const hasConversation = conversations.some(
      (item) => item._id === targetConversationId,
    );
    const isOwnMessage = !!message.senderId && message.senderId === user?._id;
    const isCurrentConversation = activeConversationId === message.conversationId;
    const isCurrentConversationVisible = isCurrentConversation && isDocumentVisible();
    const senderParticipant = conversation?.participants?.find(
      (participant: Participant) => getParticipantId(participant) === message.senderId,
    );
    const senderProfile = getParticipantProfile(senderParticipant);

    if (conversation?.participants?.length) {
      addConvo(conversation, { activate: false });
      socket.emit("join-conversation", conversation._id);
    } else if (!hasConversation) {
      void fetchConversations();
    }

    const payloadLastMessage = conversation?.lastMessage ?? message;
    const senderId =
      payloadLastMessage?.sender?._id ??
      payloadLastMessage?.senderId ??
      message?.senderId;

    const lastMessage =
      payloadLastMessage?._id
        ? {
            _id: payloadLastMessage._id,
            content: payloadLastMessage.content ?? null,
            imgUrl: payloadLastMessage.imgUrl ?? message?.imgUrl ?? null,
            isDeletedForEveryone:
              payloadLastMessage.isDeletedForEveryone ??
              message?.isDeletedForEveryone ??
              false,
            createdAt:
              payloadLastMessage.createdAt ??
              conversation?.lastMessageAt ??
              message?.createdAt,
            senderDeleted:
              payloadLastMessage.senderDeleted ?? message?.senderDeleted ?? !senderId,
            senderDisplayName:
              payloadLastMessage.senderDisplayName ??
              message?.senderDisplayName ??
              null,
            senderAvatar:
              payloadLastMessage.senderAvatar ?? message?.senderAvatar ?? null,
            sender: payloadLastMessage.sender
              ? {
                  _id: payloadLastMessage.sender._id,
                  displayName: payloadLastMessage.sender.displayName ?? "",
                  avatarUrl: payloadLastMessage.sender.avatarUrl ?? null,
                }
              : undefined,
            senderId,
          }
        : undefined;

    updateConversation({
      _id: conversation?._id ?? message.conversationId,
      type: conversation?.type,
      group: conversation?.group,
      participants: conversation?.participants,
      unreadCounts,
      seenBy: conversation?.seenBy,
      lastMessageAt:
        conversation?.lastMessageAt ?? lastMessage?.createdAt ?? message?.createdAt,
      moveToTop: true,
      ...(lastMessage ? { lastMessage } : {}),
    });
    void addMessage(message);

    if (isCurrentConversationVisible) {
      void markasSeen(message.conversationId);
    }

    if (isOwnMessage) {
      return;
    }

    if (
      shouldStoreNotification("new_message", {
        conversation,
        conversationId: message.conversationId,
      })
    ) {
      useNotificationStore.getState().addNotification({
        id: `message-${message._id}`,
        type: "new_message",
        title: "Tin nhắn mới",
        message: `${senderProfile?.displayName ?? "Ai đó"} vừa gửi tin nhắn cho bạn`,
        actorName: senderProfile?.displayName,
        entityId: message._id,
        conversationId: message.conversationId,
        messageId: message._id,
      });
    }

    if (isCurrentConversationVisible) {
      return;
    }

    const openConversation = async () => {
      setActiveConversation(message.conversationId);

      if (!messages[message.conversationId]) {
        await fetchMessages(message.conversationId);
      }

      if (isDocumentVisible()) {
        await markasSeen(message.conversationId);
      }
    };

    playSound("notification");
    notifyIncomingMessage({
      conversation,
      message,
      currentUserId: user?._id,
      onOpenConversation: () => {
        void openConversation();
      },
    });
  };

  const onMessageUpdated = ({ message, conversation }: any) => {
    useChatStore.getState().updateMessage(message);
    if (conversation) {
      useChatStore.getState().updateConversation({
        _id: conversation._id,
        unreadCounts: conversation.unreadCounts,
        seenBy: conversation.seenBy,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        moveToTop: false,
      });
    }
  };

  const onMessageRemovedForMe = ({ conversationId, messageId }: any) => {
    useChatStore.getState().removeMessageForMe(conversationId, messageId);
  };

  const onReadMessage = ({ conversation }: any) => {
    useChatStore.getState().updateConversation({
      _id: conversation._id,
      unreadCounts: conversation.unreadCounts,
      seenBy: conversation.seenBy,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
      moveToTop: false,
    });
  };

  const onNewGroup = (conversation: any) => {
    useChatStore.getState().addConvo(conversation, { activate: false });
    socket.emit("join-conversation", conversation._id);
  };

  const removeConversation = (payload: any) => {
    const conversationId =
      typeof payload === "string" ? payload : payload?.conversationId;
    if (!conversationId) return;

    useChatStore.getState().removeConversationLocal(conversationId);
    if (shouldStoreNotification("conversation_deleted")) {
      useNotificationStore.getState().addNotification({
        id: `conversation-deleted-${conversationId}-${Date.now()}`,
        type: "conversation_deleted",
        title: "Cuộc trò chuyện đã bị xóa",
        message:
          "Một cuộc trò chuyện đã bị xóa khỏi danh sách của bạn",
        entityId: conversationId,
      });
    }
  };

  const onDirectCleared = ({ conversationId }: any) => {
    useChatStore.getState().removeConversationLocal(conversationId);
  };

  const onConversationLeft = ({ conversationId, groupName, removedByOther }: any) => {
    useChatStore.getState().removeConversationLocal(conversationId);
    if (shouldStoreNotification("conversation_removed")) {
      useNotificationStore.getState().addNotification({
        id: `conversation-left-${conversationId}-${Date.now()}`,
        type: "conversation_removed",
        title: removedByOther
          ? "Bạn đã bị xóa khỏi nhóm"
          : "Bạn đã rời nhóm",
        message: removedByOther
          ? `Bạn đã bị xóa khỏi ${groupName ?? "nhóm"}`
          : `Bạn đã rời ${groupName ?? "nhóm"}`,
        entityId: conversationId,
      });
    }
    toast.message(
      removedByOther
        ? `Bạn đã bị xóa khỏi ${groupName ?? "nhóm"}`
        : `Bạn đã rời ${groupName ?? "nhóm"}`,
    );
  };

  const onMemberLeft = ({ conversationId, userId }: any) => {
    const { conversations, setConversationParticipants } = useChatStore.getState();
    const conversation = conversations.find((c) => c._id === conversationId);
    if (!conversation) return;

    const participants = conversation.participants.filter(
      (participant) => getParticipantId(participant) !== userId,
    );

    setConversationParticipants(conversationId, participants);
    toast.message("Một thành viên đã rời nhóm");
  };

  const onMemberRemoved = ({ conversationId, memberId }: any) => {
    const { conversations, setConversationParticipants } = useChatStore.getState();
    const conversation = conversations.find((c) => c._id === conversationId);
    if (!conversation) return;

    const participants = conversation.participants.filter(
      (participant) => getParticipantId(participant) !== memberId,
    );

    setConversationParticipants(conversationId, participants);
    toast.message("Một thành viên đã bị xóa khỏi nhóm");
  };

  const onMembersAdded = ({ conversationId, participants }: any) => {
    useChatStore.getState().setConversationParticipants(conversationId, participants);
    toast.message("Nhóm vừa có thêm thành viên mới");
  };

  const onConversationUpdated = ({ conversation }: any) => {
    useChatStore.getState().updateConversation({
      _id: conversation._id,
      group: conversation.group,
      participants: conversation.participants,
      unreadCounts: conversation.unreadCounts,
      seenBy: conversation.seenBy,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
      moveToTop: false,
    });
  };

  const onMessageBulkUpdated = ({ conversationId }: any) => {
    useChatStore.setState((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: {
          items: [],
          hasMore: true,
          nextCursor: undefined,
        },
      },
    }));
    void useChatStore.getState().fetchMessages(conversationId);
  };

  const onDirectBlockStatus = ({
    conversationId,
    blockerId,
    blockedUserId,
    isBlocked,
  }: any) => {
    if (!conversationId || !blockerId || !blockedUserId) {
      return;
    }

    const meId = useAuthStore.getState().user?._id;
    const currentConversation = useChatStore
      .getState()
      .conversations.find((conversation) => conversation._id === conversationId);

    useChatStore.getState().updateConversation({
      _id: conversationId,
      blockInfo: mergeDirectBlockInfo(currentConversation?.blockInfo, meId, {
        blockerId,
        blockedUserId,
        isBlocked,
      }),
      moveToTop: false,
    });
  };

  const onAddedToGroup = ({ groupName }: any) => {
    if (shouldStoreNotification("added_to_group")) {
      useNotificationStore.getState().addNotification({
        id: `added-to-group-${groupName}-${Date.now()}`,
        type: "added_to_group",
        title: "Bạn được thêm vào nhóm",
        message: `Bạn vừa được thêm vào ${groupName}`,
      });
    }
    toast.success(`Bạn vừa được thêm vào ${groupName}`);
  };

  socket.on("connect", onConnect);
  socket.on("online-users", onOnlineUsers);
  socket.on("new-message", onNewMessage);
  socket.on("message:updated", onMessageUpdated);
  socket.on("message:removed-for-me", onMessageRemovedForMe);
  socket.on("read-message", onReadMessage);
  socket.on("new-group", onNewGroup);
  socket.on("conversation:deleted", removeConversation);
  socket.on("group-deleted", removeConversation);
  socket.on("conversation:direct-cleared", onDirectCleared);
  socket.on("conversation:left", onConversationLeft);
  socket.on("conversation:member-left", onMemberLeft);
  socket.on("conversation:member-removed", onMemberRemoved);
  socket.on("conversation:members-added", onMembersAdded);
  socket.on("conversation:updated", onConversationUpdated);
  socket.on("message:bulk-updated", onMessageBulkUpdated);
  socket.on("direct:block-status", onDirectBlockStatus);
  socket.on("added-to-group", onAddedToGroup);

  return () => {
    socket.off("connect", onConnect);
    socket.off("online-users", onOnlineUsers);
    socket.off("new-message", onNewMessage);
    socket.off("message:updated", onMessageUpdated);
    socket.off("message:removed-for-me", onMessageRemovedForMe);
    socket.off("read-message", onReadMessage);
    socket.off("new-group", onNewGroup);
    socket.off("conversation:deleted", removeConversation);
    socket.off("group-deleted", removeConversation);
    socket.off("conversation:direct-cleared", onDirectCleared);
    socket.off("conversation:left", onConversationLeft);
    socket.off("conversation:member-left", onMemberLeft);
    socket.off("conversation:member-removed", onMemberRemoved);
    socket.off("conversation:members-added", onMembersAdded);
    socket.off("conversation:updated", onConversationUpdated);
    socket.off("message:bulk-updated", onMessageBulkUpdated);
    socket.off("direct:block-status", onDirectBlockStatus);
    socket.off("added-to-group", onAddedToGroup);
  };
};
