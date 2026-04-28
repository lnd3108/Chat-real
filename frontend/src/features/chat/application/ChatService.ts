import {
  getLastMessageSenderId,
  getParticipantId,
  hasHydratedParticipants,
  normalizeSeenUser,
} from "@/features/chat/lib/chatParticipants";
import type { ChatRepository } from "@/features/chat/data/ChatRepository";
import type { Conversation, Message } from "@/shared/types/chat";
import type { ConversationPatch } from "@/shared/types/store";

export class ChatService {
  private readonly repository: ChatRepository;

  constructor(repository: ChatRepository) {
    this.repository = repository;
  }

  fetchConversations() {
    return this.repository.fetchConversations();
  }

  fetchMessages(conversationId: string, cursor?: string) {
    return this.repository.fetchMessages(conversationId, cursor);
  }

  sendDirectMessage(
    recipientId: string,
    content: string = "",
    imgUrl?: string,
    conversationId?: string,
    replyToMessageId?: string,
  ) {
    return this.repository.sendDirectMessage(
      recipientId,
      content,
      imgUrl,
      conversationId,
      replyToMessageId,
    );
  }

  sendGroupMessage(
    conversationId: string,
    content: string = "",
    imgUrl?: string,
    replyToMessageId?: string,
  ) {
    return this.repository.sendGroupMessage(
      conversationId,
      content,
      imgUrl,
      replyToMessageId,
    );
  }

  sendDirectMessageWithImage(
    recipientId: string,
    image: File,
    content: string = "",
    conversationId?: string,
    replyToMessageId?: string,
    onUploadProgress?: (progress: number) => void,
  ) {
    return this.repository.sendDirectMessageWithImage(
      recipientId,
      image,
      content,
      conversationId,
      replyToMessageId,
      onUploadProgress,
    );
  }

  sendGroupMessageWithImage(
    conversationId: string,
    image: File,
    content: string = "",
    replyToMessageId?: string,
    onUploadProgress?: (progress: number) => void,
  ) {
    return this.repository.sendGroupMessageWithImage(
      conversationId,
      image,
      content,
      replyToMessageId,
      onUploadProgress,
    );
  }

  markasSeen(conversationId: string) {
    return this.repository.markasSeen(conversationId);
  }

  createConversation(type: "direct" | "group", name: string, memberIds: string[]) {
    return this.repository.createConversation(type, name, memberIds);
  }

  getOrCreateSupportConversation() {
    return this.repository.getOrCreateSupportConversation();
  }

  fetchMySupportConversations() {
    return this.repository.fetchMySupportConversations();
  }

  sendSupportMessage(conversationId: string, content: string) {
    return this.repository.sendSupportMessage(conversationId, content);
  }

  deleteOrLeaveGroupConversation(conversationId: string) {
    return this.repository.deleteOrLeaveGroupConversation(conversationId);
  }

  addGroupMembers(conversationId: string, memberIds: string[]) {
    return this.repository.addGroupMembers(conversationId, memberIds);
  }

  removeGroupMember(conversationId: string, memberId: string) {
    return this.repository.removeGroupMember(conversationId, memberId);
  }

  uploadGroupAvatar(conversationId: string, file: File) {
    return this.repository.uploadGroupAvatar(conversationId, file);
  }

  updateGroupName(conversationId: string, name: string) {
    return this.repository.updateGroupName(conversationId, name);
  }

  editMessage(messageId: string, content: string) {
    return this.repository.editMessage(messageId, content);
  }

  deleteMessageForMe(messageId: string) {
    return this.repository.deleteMessageForMe(messageId);
  }

  deleteMessageForEveryone(messageId: string) {
    return this.repository.deleteMessageForEveryone(messageId);
  }

  toggleReaction(messageId: string, emoji: string) {
    return this.repository.toggleReaction(messageId, emoji);
  }

  deleteSupportConversation(conversationId: string) {
    return this.repository.deleteSupportConversation(conversationId);
  }

  normalizeIncomingMessage(message: Message, userId?: string) {
    return {
      ...message,
      isOwn: !!message.senderId && message.senderId === userId,
    };
  }

  mergeConversationsById(
    currentConversations: Conversation[],
    incomingConversations: Conversation[],
  ) {
    const mergedById = new Map(
      currentConversations.map((conversation) => [conversation._id, conversation]),
    );

    incomingConversations.forEach((conversation) => {
      const current = mergedById.get(conversation._id);
      mergedById.set(
        conversation._id,
        current ? { ...current, ...conversation } : conversation,
      );
    });

    return Array.from(mergedById.values()).sort(
      (left, right) =>
        this.getConversationSortTime(right) - this.getConversationSortTime(left),
    );
  }

  resolveDirectRecipientId(params: {
    recipientId?: string;
    activeConversationId: string | null;
    conversations: Conversation[];
    currentUserId?: string;
  }) {
    if (params.recipientId) return params.recipientId;
    if (!params.activeConversationId || !params.currentUserId) return undefined;

    const convo = params.conversations.find(
      (item) => item._id === params.activeConversationId,
    );
    const other = convo?.participants?.find((participant) => {
      const uid = getParticipantId(participant);
      return uid && uid !== params.currentUserId;
    });

    return other ? getParticipantId(other) : undefined;
  }

  mergeConversationPatch(
    current: Conversation,
    conversation: ConversationPatch,
  ): Conversation {
    const seenBy = conversation.seenBy?.map(normalizeSeenUser);
    const { moveToTop: _moveToTop, ...conversationData } = conversation;
    const merged: Conversation = {
      ...current,
      ...conversationData,
      seenBy: seenBy ?? current.seenBy,
    };

    const incoming = conversationData.participants;
    const participantsHydrated = hasHydratedParticipants(incoming);

    if (!participantsHydrated) merged.participants = current.participants;
    if (conversationData.group == null) merged.group = current.group;
    if (!conversationData.type) merged.type = current.type;
    if (!conversationData.lastMessage) merged.lastMessage = current.lastMessage;

    return merged;
  }

  shouldMarkConversationSeen(params: {
    conversation?: Conversation;
    currentUserId?: string;
  }) {
    const { conversation, currentUserId } = params;
    if (!conversation?.lastMessage || !currentUserId) return false;

    const senderId = getLastMessageSenderId(conversation.lastMessage);
    if (!senderId || senderId === currentUserId) return false;

    const myUnread = conversation.unreadCounts?.[currentUserId];
    return !(typeof myUnread === "number" && myUnread === 0);
  }

  private getConversationSortTime(conversation: Conversation) {
    return new Date(
      conversation.lastMessageAt ??
        conversation.updatedAt ??
        conversation.createdAt ??
        0,
    ).getTime();
  }
}
