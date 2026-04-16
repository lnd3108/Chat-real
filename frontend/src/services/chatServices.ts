import api from "@/lib/axios";
import type { ConversationResponse, Message } from "@/types/chat";

interface FetchMessagesProps {
  messages: Message[];
  cursor?: string;
}

const pageLimit = 50;

export const chatServices = {
  async fetchConversations(): Promise<ConversationResponse> {
    const res = await api.get("/conversations");
    return res.data;
  },

  async fetchMessages(
    id: string,
    cursor?: string,
  ): Promise<FetchMessagesProps> {
    const res = await api.get(
      `/conversations/${id}/messages?limit=${pageLimit}&cursor=${cursor}`,
    );
    return { messages: res.data.messages, cursor: res.data.nextCursor };
  },

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
    return res.data.message;
  },

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
    return res.data.message;
  },

  async sendDirectMessageWithImage(
    recipientId: string,
    image: File,
    content: string = "",
    conversationId?: string,
    replyToMessageId?: string,
  ) {
    const formData = new FormData();
    formData.append("recipientId", recipientId);
    formData.append("image", image);
    if (content.trim()) formData.append("content", content.trim());
    if (conversationId) formData.append("conversationId", conversationId);
    if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);

    const res = await api.post("/messages/direct/with-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.message;
  },

  async sendGroupMessageWithImage(
    conversationId: string,
    image: File,
    content: string = "",
    replyToMessageId?: string,
  ) {
    const formData = new FormData();
    formData.append("conversationId", conversationId);
    formData.append("image", image);
    if (content.trim()) formData.append("content", content.trim());
    if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);

    const res = await api.post("/messages/group/with-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.message;
  },

  async markasSeen(conversationId: string) {
    const res = await api.patch(`/conversations/${conversationId}/seen`);
    return res.data;
  },

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
    return res.data.conversation;
  },

  async deleteOrLeaveGroupConversation(conversationId: string) {
    const res = await api.delete(`/conversations/${conversationId}`);
    return res.data;
  },

  async addGroupMembers(conversationId: string, memberIds: string[]) {
    const res = await api.patch(
      `/conversations/${conversationId}/members/add`,
      {
        memberIds,
      },
    );
    return res.data;
  },

  async removeGroupMember(conversationId: string, memberId: string) {
    const res = await api.patch(
      `/conversations/${conversationId}/members/remove`,
      { memberId },
    );
    return res.data;
  },

  async uploadGroupAvatar(conversationId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await api.post(`/conversations/${conversationId}/avatar`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return res.data.conversation;
  },

  async editMessage(messageId: string, content: string) {
    const res = await api.patch(`/messages/${messageId}`, { content });
    return res.data.message as Message;
  },

  async deleteMessageForMe(messageId: string) {
    const res = await api.delete(`/messages/${messageId}/me`);
    return res.data;
  },

  async deleteMessageForEveryone(messageId: string) {
    const res = await api.delete(`/messages/${messageId}/everyone`);
    return res.data.message as Message;
  },

  async toggleReaction(messageId: string, emoji: string) {
    const res = await api.post(`/messages/${messageId}/reactions`, { emoji });
    return res.data.message as Message;
  },
};
