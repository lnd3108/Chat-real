import api from "@/shared/api/axios";
import type { Conversation, ConversationResponse, Message } from "@/shared/types/chat";
import {
  toUploadPercent,
  uploadTimeoutMs,
  type ChatRepository,
  type FetchMessagesResult,
  type SendDirectMessageResult,
} from "@/features/chat/data/ChatRepository";

const pageLimit = 50;

export class ChatApiRepository implements ChatRepository {
  async fetchConversations(): Promise<ConversationResponse> {
    const res = await api.get("/conversations");
    return res.data;
  }

  async fetchMessages(id: string, cursor?: string): Promise<FetchMessagesResult> {
    const res = await api.get(
      `/conversations/${id}/messages?limit=${pageLimit}&cursor=${cursor}`,
    );
    return { messages: res.data.messages, cursor: res.data.nextCursor };
  }

  async sendDirectMessage(
    recipientId: string,
    content: string = "",
    imgUrl?: string,
    conversationId?: string,
    replyToMessageId?: string,
  ) {
    const res = await api.post("/messages/direct", {
      recipientId,
      content,
      imgUrl,
      conversationId,
      replyToMessageId,
    });
    return res.data as SendDirectMessageResult;
  }

  async sendGroupMessage(
    conversationId: string,
    content: string = "",
    imgUrl?: string,
    replyToMessageId?: string,
  ) {
    const res = await api.post("/messages/group", {
      conversationId,
      content,
      imgUrl,
      replyToMessageId,
    });
    return res.data.message as Message;
  }

  async sendDirectMessageWithImage(
    recipientId: string,
    image: File,
    content: string = "",
    conversationId?: string,
    replyToMessageId?: string,
    onUploadProgress?: (progress: number) => void,
  ) {
    const formData = new FormData();
    formData.append("recipientId", recipientId);
    formData.append("image", image);
    if (content.trim()) formData.append("content", content.trim());
    if (conversationId) formData.append("conversationId", conversationId);
    if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);

    const res = await api.post("/messages/direct/with-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: uploadTimeoutMs,
      onUploadProgress: (event) => {
        onUploadProgress?.(toUploadPercent(event));
      },
    });
    return res.data as SendDirectMessageResult;
  }

  async sendGroupMessageWithImage(
    conversationId: string,
    image: File,
    content: string = "",
    replyToMessageId?: string,
    onUploadProgress?: (progress: number) => void,
  ) {
    const formData = new FormData();
    formData.append("conversationId", conversationId);
    formData.append("image", image);
    if (content.trim()) formData.append("content", content.trim());
    if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);

    const res = await api.post("/messages/group/with-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: uploadTimeoutMs,
      onUploadProgress: (event) => {
        onUploadProgress?.(toUploadPercent(event));
      },
    });
    return res.data.message as Message;
  }

  async markasSeen(conversationId: string) {
    const res = await api.patch(`/conversations/${conversationId}/seen`);
    return res.data;
  }

  async createConversation(
    type: "direct" | "group",
    name: string,
    memberIds: string[],
  ) {
    const payload = {
      type,
      memberIds,
      ...(type === "group" ? { name } : {}),
    };

    const res = await api.post("/conversations", payload);
    return res.data.conversation as Conversation;
  }

  async getOrCreateSupportConversation() {
    const res = await api.post("/support/conversations");
    return res.data.data.conversation as Conversation;
  }

  async fetchMySupportConversations() {
    const res = await api.get("/support/conversations/me");
    return res.data.data.conversations as Conversation[];
  }

  async sendSupportMessage(conversationId: string, content: string) {
    const res = await api.post("/support/messages", { conversationId, content });
    return res.data.data as { message: Message; conversation: Conversation };
  }

  async deleteOrLeaveGroupConversation(conversationId: string) {
    const res = await api.delete(`/conversations/${conversationId}`);
    return res.data;
  }

  async addGroupMembers(conversationId: string, memberIds: string[]) {
    const res = await api.patch(`/conversations/${conversationId}/members/add`, {
      memberIds,
    });
    return res.data;
  }

  async removeGroupMember(conversationId: string, memberId: string) {
    const res = await api.patch(`/conversations/${conversationId}/members/remove`, {
      memberId,
    });
    return res.data;
  }

  async uploadGroupAvatar(conversationId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await api.post(`/conversations/${conversationId}/avatar`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: uploadTimeoutMs,
    });

    return res.data.conversation as Conversation;
  }

  async updateGroupName(conversationId: string, name: string) {
    const res = await api.patch(`/conversations/${conversationId}/name`, { name });
    return res.data.conversation as Conversation;
  }

  async editMessage(messageId: string, content: string) {
    const res = await api.patch(`/messages/${messageId}`, { content });
    return res.data.message as Message;
  }

  async deleteMessageForMe(messageId: string) {
    const res = await api.delete(`/messages/${messageId}/me`);
    return res.data;
  }

  async deleteMessageForEveryone(messageId: string) {
    const res = await api.delete(`/messages/${messageId}/everyone`);
    return res.data.message as Message;
  }

  async toggleReaction(messageId: string, emoji: string) {
    const res = await api.post(`/messages/${messageId}/reactions`, { emoji });
    return res.data.message as Message;
  }

  async deleteSupportConversation(conversationId: string) {
    const res = await api.delete(`/support/conversations/${conversationId}`);
    return res.data;
  }
}
