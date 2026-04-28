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

export class ChatSocketHandler {
  private socket: Socket | null = null;
  private readonly options: ChatSocketHandlerOptions;

  constructor(options: ChatSocketHandlerOptions) {
    this.options = options;
  }

  register(socket: Socket) {
    this.unregister(socket);
    this.socket = socket;
    socket.on("connect", this.handleConnect);
    socket.on("online-users", this.handleOnlineUsers);
    socket.on("new-message", this.handleNewMessage);
    socket.on("message:updated", this.handleMessageUpdated);
    socket.on("message:removed-for-me", this.handleMessageRemovedForMe);
    socket.on("read-message", this.handleReadMessage);
    socket.on("new-group", this.handleNewGroup);
    socket.on("conversation:deleted", this.handleRemoveConversation);
    socket.on("group-deleted", this.handleRemoveConversation);
    socket.on("conversation:direct-cleared", this.handleDirectCleared);
    socket.on("conversation:left", this.handleConversationLeft);
    socket.on("conversation:member-left", this.handleMemberLeft);
    socket.on("conversation:member-removed", this.handleMemberRemoved);
    socket.on("conversation:members-added", this.handleMembersAdded);
    socket.on("conversation:updated", this.handleConversationUpdated);
    socket.on("message:bulk-updated", this.handleMessageBulkUpdated);
    socket.on("direct:block-status", this.handleDirectBlockStatus);
    socket.on("added-to-group", this.handleAddedToGroup);
  }

  unregister(socket: Socket) {
    socket.off("connect", this.handleConnect);
    socket.off("online-users", this.handleOnlineUsers);
    socket.off("new-message", this.handleNewMessage);
    socket.off("message:updated", this.handleMessageUpdated);
    socket.off("message:removed-for-me", this.handleMessageRemovedForMe);
    socket.off("read-message", this.handleReadMessage);
    socket.off("new-group", this.handleNewGroup);
    socket.off("conversation:deleted", this.handleRemoveConversation);
    socket.off("group-deleted", this.handleRemoveConversation);
    socket.off("conversation:direct-cleared", this.handleDirectCleared);
    socket.off("conversation:left", this.handleConversationLeft);
    socket.off("conversation:member-left", this.handleMemberLeft);
    socket.off("conversation:member-removed", this.handleMemberRemoved);
    socket.off("conversation:members-added", this.handleMembersAdded);
    socket.off("conversation:updated", this.handleConversationUpdated);
    socket.off("message:bulk-updated", this.handleMessageBulkUpdated);
    socket.off("direct:block-status", this.handleDirectBlockStatus);
    socket.off("added-to-group", this.handleAddedToGroup);
    if (this.socket === socket) this.socket = null;
  }

  private handleConnect = () => {
    this.socket?.emit("preferences:showOnlineStatus", this.options.getShowOnlineStatus());
    this.socket?.emit(
      "conversation:active",
      isDocumentVisible() ? useChatStore.getState().activeConversationId : null,
    );
  };

  private handleOnlineUsers = (userIds: string[]) => {
    this.options.setOnlineUsers(userIds);
  };

  private handleNewMessage = ({ message, conversation, unreadCounts }: any) => {
    const socket = this.socket;
    if (!socket) return;

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

    if (isOwnMessage) return;

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

    if (isCurrentConversationVisible) return;

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

  private handleMessageUpdated = ({ message, conversation }: any) => {
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

  private handleMessageRemovedForMe = ({ conversationId, messageId }: any) => {
    useChatStore.getState().removeMessageForMe(conversationId, messageId);
  };

  private handleReadMessage = ({ conversation }: any) => {
    useChatStore.getState().updateConversation({
      _id: conversation._id,
      unreadCounts: conversation.unreadCounts,
      seenBy: conversation.seenBy,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
      moveToTop: false,
    });
  };

  private handleNewGroup = (conversation: any) => {
    useChatStore.getState().addConvo(conversation, { activate: false });
    this.socket?.emit("join-conversation", conversation._id);
  };

  private handleRemoveConversation = (payload: any) => {
    const conversationId =
      typeof payload === "string" ? payload : payload?.conversationId;
    if (!conversationId) return;

    useChatStore.getState().removeConversationLocal(conversationId);
    if (shouldStoreNotification("conversation_deleted")) {
      useNotificationStore.getState().addNotification({
        id: `conversation-deleted-${conversationId}-${Date.now()}`,
        type: "conversation_deleted",
        title: "Cuộc trò chuyện đã bị xóa",
        message: "Một cuộc trò chuyện đã bị xóa khỏi danh sách của bạn",
        entityId: conversationId,
      });
    }
  };

  private handleDirectCleared = ({ conversationId }: any) => {
    useChatStore.getState().removeConversationLocal(conversationId);
  };

  private handleConversationLeft = ({
    conversationId,
    groupName,
    removedByOther,
  }: any) => {
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

  private handleMemberLeft = ({ conversationId, userId }: any) => {
    const { conversations, setConversationParticipants } = useChatStore.getState();
    const conversation = conversations.find((c) => c._id === conversationId);
    if (!conversation) return;

    const participants = conversation.participants.filter(
      (participant) => getParticipantId(participant) !== userId,
    );

    setConversationParticipants(conversationId, participants);
    toast.message("Một thành viên đã rời nhóm");
  };

  private handleMemberRemoved = ({ conversationId, memberId }: any) => {
    const { conversations, setConversationParticipants } = useChatStore.getState();
    const conversation = conversations.find((c) => c._id === conversationId);
    if (!conversation) return;

    const participants = conversation.participants.filter(
      (participant) => getParticipantId(participant) !== memberId,
    );

    setConversationParticipants(conversationId, participants);
    toast.message("Một thành viên đã bị xóa khỏi nhóm");
  };

  private handleMembersAdded = ({ conversationId, participants }: any) => {
    useChatStore.getState().setConversationParticipants(conversationId, participants);
    toast.message("Nhóm vừa có thêm thành viên mới");
  };

  private handleConversationUpdated = ({ conversation }: any) => {
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

  private handleMessageBulkUpdated = ({ conversationId }: any) => {
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

  private handleDirectBlockStatus = ({
    conversationId,
    blockerId,
    blockedUserId,
    isBlocked,
  }: any) => {
    if (!conversationId || !blockerId || !blockedUserId) return;

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

  private handleAddedToGroup = ({ groupName }: any) => {
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
}
