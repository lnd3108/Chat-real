import type { AxiosProgressEvent } from "axios";
import type {
  Conversation,
  ConversationResponse,
  Message,
} from "@/shared/types/chat";

export interface FetchMessagesResult {
  messages: Message[];
  cursor?: string;
}

export interface SendDirectMessageResult {
  message: Message;
  conversation?: Conversation | null;
}

export interface ChatRepository {
  fetchConversations(): Promise<ConversationResponse>;
  fetchMessages(id: string, cursor?: string): Promise<FetchMessagesResult>;
  sendDirectMessage(
    recipientId: string,
    content?: string,
    imgUrl?: string,
    conversationId?: string,
    replyToMessageId?: string,
  ): Promise<SendDirectMessageResult>;
  sendGroupMessage(
    conversationId: string,
    content?: string,
    imgUrl?: string,
    replyToMessageId?: string,
  ): Promise<Message>;
  sendDirectMessageWithImage(
    recipientId: string,
    image: File,
    content?: string,
    conversationId?: string,
    replyToMessageId?: string,
    onUploadProgress?: (progress: number) => void,
  ): Promise<SendDirectMessageResult>;
  sendGroupMessageWithImage(
    conversationId: string,
    image: File,
    content?: string,
    replyToMessageId?: string,
    onUploadProgress?: (progress: number) => void,
  ): Promise<Message>;
  markasSeen(conversationId: string): Promise<unknown>;
  createConversation(
    type: "direct" | "group",
    name: string,
    memberIds: string[],
  ): Promise<Conversation>;
  getOrCreateSupportConversation(): Promise<Conversation>;
  fetchMySupportConversations(): Promise<Conversation[]>;
  sendSupportMessage(
    conversationId: string,
    content: string,
  ): Promise<{ message: Message; conversation: Conversation }>;
  deleteOrLeaveGroupConversation(conversationId: string): Promise<unknown>;
  addGroupMembers(conversationId: string, memberIds: string[]): Promise<unknown>;
  removeGroupMember(conversationId: string, memberId: string): Promise<unknown>;
  uploadGroupAvatar(conversationId: string, file: File): Promise<Conversation>;
  updateGroupName(conversationId: string, name: string): Promise<Conversation>;
  editMessage(messageId: string, content: string): Promise<Message>;
  deleteMessageForMe(messageId: string): Promise<unknown>;
  deleteMessageForEveryone(messageId: string): Promise<Message>;
  toggleReaction(messageId: string, emoji: string): Promise<Message>;
  deleteSupportConversation(conversationId: string): Promise<unknown>;
}

export const uploadTimeoutMs = 30000;

export const toUploadPercent = (event: AxiosProgressEvent) => {
  if (!event.total) return 0;
  return Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)));
};
