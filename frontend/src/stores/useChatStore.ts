import { chatServices } from "@/services/chatServices";
import {
  getLastMessageSenderId,
  getParticipantId,
  hasHydratedParticipants,
  normalizeSeenUser,
} from "@/lib/chatParticipants";
import type { Conversation, Message } from "@/types/chat";
import type { ChatState } from "@/types/store";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import { useAuthStore } from "./useAuthStore";
import { useSocketStore } from "./useSocketStore";

const inflightMessageFetches = new Map<string, Promise<void>>();

const normalizeIncomingMessage = (message: Message, userId?: string) => ({
  ...message,
  isOwn: message.senderId === userId,
});

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: {},
      activeConversationId: null,
      replyingTo: null,
      editingMessage: null,
      convoLoading: false,
      messageLoading: false,
      loading: false,

      reset: () =>
        set({
          conversations: [],
          messages: {},
          activeConversationId: null,
          replyingTo: null,
          editingMessage: null,
          convoLoading: false,
          messageLoading: false,
        }),
      setActiveConversation: (id) => set({ activeConversationId: id }),

      fetchConversations: async () => {
        try {
          set({ convoLoading: true });
          const { conversations } = await chatServices.fetchConversations();
          set({ conversations, convoLoading: false });
        } catch (error) {
          console.error("Failed to fetch conversations:", error);
          set({ convoLoading: false });
        }
      },

      fetchMessages: async (conversationId?: string) => {
        const { activeConversationId, messages } = get();
        const { user } = useAuthStore.getState();
        const convoId = conversationId ?? activeConversationId;

        if (!convoId) return;

        const current = messages?.[convoId];
        const nextCursor = current?.nextCursor ?? undefined;
        if (current && current.nextCursor === null) return;
        if (nextCursor === null) return;

        const requestKey = `${convoId}::${nextCursor ?? "__initial__"}`;
        const inflight = inflightMessageFetches.get(requestKey);
        if (inflight) {
          await inflight;
          return;
        }

        const request = (async () => {
          set({ messageLoading: true });

          try {
            const { messages: fetched, cursor } =
              await chatServices.fetchMessages(convoId, nextCursor);

            const processed = fetched.map((message) =>
              normalizeIncomingMessage(message, user?._id),
            );

            set((state) => {
              const prev = state.messages[convoId]?.items ?? [];
              const merged = prev.length > 0 ? [...processed, ...prev] : processed;
              const deduped = merged.filter(
                (item, index, arr) =>
                  arr.findIndex((candidate) => candidate._id === item._id) === index,
              );

              return {
                messages: {
                  ...state.messages,
                  [convoId]: {
                    items: deduped,
                    hasMore: !!cursor,
                    nextCursor: cursor ?? null,
                  },
                },
              };
            });
          } catch (error) {
            console.error("Failed to fetch messages:", error);
          } finally {
            inflightMessageFetches.delete(requestKey);
            set({ messageLoading: false });
          }
        })();

        inflightMessageFetches.set(requestKey, request);
        await request;
      },

      sendDirectMessage: async (recipientId, content, imgUrl) => {
        try {
          const { activeConversationId, conversations, replyingTo } = get();
          const me = useAuthStore.getState().user?._id;

          let finalRecipientId: string | undefined = recipientId;

          if (!finalRecipientId && activeConversationId && me) {
            const convo = conversations.find((item) => item._id === activeConversationId);
            const other = convo?.participants?.find((participant) => {
              const uid = getParticipantId(participant);
              return uid && uid !== me;
            });
            finalRecipientId = other ? getParticipantId(other) : undefined;
          }

          if (!finalRecipientId) {
            console.error("Missing recipientId: cannot send direct message");
            return;
          }

          await chatServices.sendDirectMessage(
            finalRecipientId,
            content,
            imgUrl,
            activeConversationId || undefined,
            replyingTo?._id,
          );

          set((state) => ({
            conversations: state.conversations.map((conversation) =>
              conversation._id === activeConversationId
                ? { ...conversation, seenBy: [] }
                : conversation,
            ),
            replyingTo: null,
          }));
        } catch (error: unknown) {
          console.error("Failed to send direct message", error);
          throw error;
        }
      },

      sendDirectMessageWithImage: async (
        recipientId,
        image,
        content = "",
        options,
      ) => {
        try {
          const { activeConversationId, conversations, replyingTo } = get();
          const me = useAuthStore.getState().user?._id;

          let finalRecipientId: string | undefined = recipientId;

          if (!finalRecipientId && activeConversationId && me) {
            const convo = conversations.find((item) => item._id === activeConversationId);
            const other = convo?.participants?.find((participant) => {
              const uid = getParticipantId(participant);
              return uid && uid !== me;
            });
            finalRecipientId = other ? getParticipantId(other) : undefined;
          }

          if (!finalRecipientId) {
            console.error("Missing recipientId: cannot send direct image");
            return;
          }

          await chatServices.sendDirectMessageWithImage(
            finalRecipientId,
            image,
            content,
            activeConversationId || undefined,
            replyingTo?._id,
            options?.onUploadProgress,
          );

          set((state) => ({
            conversations: state.conversations.map((conversation) =>
              conversation._id === activeConversationId
                ? { ...conversation, seenBy: [] }
                : conversation,
            ),
            replyingTo: null,
          }));
        } catch (error) {
          console.error("Failed to send direct image", error);
          throw error;
        }
      },

      sendGroupMessage: async (conversationId, content, imgUrl) => {
        try {
          await chatServices.sendGroupMessage(
            conversationId,
            content,
            imgUrl,
            get().replyingTo?._id,
          );
          set((state) => ({
            conversations: state.conversations.map((conversation) =>
              conversation._id === get().activeConversationId
                ? { ...conversation, seenBy: [] }
                : conversation,
            ),
            replyingTo: null,
          }));
        } catch (error) {
          console.error("Failed to send group message", error);
          throw error;
        }
      },

      sendGroupMessageWithImage: async (
        conversationId,
        image,
        content = "",
        options,
      ) => {
        try {
          await chatServices.sendGroupMessageWithImage(
            conversationId,
            image,
            content,
            get().replyingTo?._id,
            options?.onUploadProgress,
          );
          set((state) => ({
            conversations: state.conversations.map((conversation) =>
              conversation._id === get().activeConversationId
                ? { ...conversation, seenBy: [] }
                : conversation,
            ),
            replyingTo: null,
          }));
        } catch (error) {
          console.error("Failed to send group image", error);
          throw error;
        }
      },

      editMessage: async (messageId, content) => {
        try {
          const message = await chatServices.editMessage(messageId, content);
          get().updateMessage(message);
          set({ editingMessage: null });
        } catch (error) {
          console.error("Failed to edit message", error);
        }
      },

      deleteMessageForMe: async (messageId) => {
        try {
          const { activeConversationId } = get();
          await chatServices.deleteMessageForMe(messageId);
          if (activeConversationId) {
            get().removeMessageForMe(activeConversationId, messageId);
          }
        } catch (error) {
          console.error("Failed to delete message for me", error);
          toast.error("Không thể xóa tin nhắn ở phía bạn.");
          throw error;
        }
      },

      deleteMessageForEveryone: async (messageId) => {
        try {
          const message = await chatServices.deleteMessageForEveryone(messageId);
          get().updateMessage(message);
        } catch (error) {
          console.error("Failed to delete message for everyone", error);
          toast.error("Không thể thu hồi tin nhắn lúc này.");
          throw error;
        }
      },

      toggleReaction: async (messageId, emoji) => {
        try {
          const message = await chatServices.toggleReaction(messageId, emoji);
          get().updateMessage(message);
        } catch (error) {
          console.error("Failed to toggle reaction", error);
        }
      },

      addMessage: async (message) => {
        try {
          const { user } = useAuthStore.getState();
          const normalized = normalizeIncomingMessage(message, user?._id);
          const convoId = normalized.conversationId;

          set((state) => {
            const current = state.messages[convoId] ?? {
              items: [],
              hasMore: true,
              nextCursor: undefined,
            };

            if (current.items.some((item) => item._id === normalized._id)) return state;

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  ...current,
                  items: [...current.items, normalized],
                },
              },
            };
          });
        } catch (error) {
          console.error("Failed to add message:", error);
        }
      },

      updateMessage: (message) => {
        const { user } = useAuthStore.getState();
        const normalized = normalizeIncomingMessage(message, user?._id);
        const convoId = normalized.conversationId;

        set((state) => {
          const current = state.messages[convoId];
          if (!current) return state;

          return {
            messages: {
              ...state.messages,
              [convoId]: {
                ...current,
                items: current.items.map((item) =>
                  item._id === normalized._id ? { ...item, ...normalized } : item,
                ),
              },
            },
            replyingTo:
              state.replyingTo?._id === normalized._id ? normalized : state.replyingTo,
            editingMessage:
              state.editingMessage?._id === normalized._id
                ? normalized
                : state.editingMessage,
          };
        });
      },

      removeMessageForMe: (conversationId, messageId) => {
        set((state) => {
          const current = state.messages[conversationId];
          if (!current) return state;

          return {
            messages: {
              ...state.messages,
              [conversationId]: {
                ...current,
                items: current.items.filter((item) => item._id !== messageId),
              },
            },
            replyingTo: state.replyingTo?._id === messageId ? null : state.replyingTo,
            editingMessage:
              state.editingMessage?._id === messageId ? null : state.editingMessage,
          };
        });
      },

      setReplyingTo: (message) => set({ replyingTo: message, editingMessage: null }),
      setEditingMessage: (message) =>
        set({ editingMessage: message, replyingTo: null }),

      updateConversation: (conversation) => {
        const seenBy = conversation.seenBy?.map(normalizeSeenUser);
        const { moveToTop, ...conversationData } = conversation;

        set((state) => {
          const currentIndex = state.conversations.findIndex(
            (item) => item._id === conversation._id,
          );

          if (currentIndex === -1) {
            return { conversations: state.conversations };
          }

          const current = state.conversations[currentIndex];
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

          const nextConversations = [...state.conversations];
          nextConversations[currentIndex] = merged;

          const shouldMoveToTop =
            moveToTop ??
            Boolean(conversation.lastMessage || conversation.lastMessageAt);

          if (!shouldMoveToTop || currentIndex === 0) {
            return { conversations: nextConversations };
          }

          nextConversations.splice(currentIndex, 1);
          nextConversations.unshift(merged);
          return { conversations: nextConversations };
        });
      },

      setConversationParticipants: (conversationId, participants) => {
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation._id === conversationId
              ? { ...conversation, participants }
              : conversation,
          ),
        }));
      },

      removeConversationLocal: (conversationId: string) => {
        useSocketStore.getState().socket?.emit("leave-conversation", conversationId);

        set((state) => {
          const nextConvos = state.conversations.filter(
            (conversation) => conversation._id !== conversationId,
          );
          const nextMessages = { ...state.messages };
          delete nextMessages[conversationId];

          return {
            conversations: nextConvos,
            messages: nextMessages,
            activeConversationId:
              state.activeConversationId === conversationId
                ? null
                : state.activeConversationId,
          };
        });
      },

      deleteOrLeaveGroupConversation: async (conversationId?: string) => {
        try {
          const { activeConversationId } = get();
          const id = conversationId ?? activeConversationId;
          if (!id) return;

          await chatServices.deleteOrLeaveGroupConversation(id);
          get().removeConversationLocal(id);
        } catch (error: unknown) {
          console.error(
            "deleteOrLeaveGroupConversation failed:",
            error,
          );
        }
      },

      markasSeen: async (conversationId?: string | null) => {
        try {
          const { user } = useAuthStore.getState();
          const { activeConversationId, conversations } = get();
          const targetConversationId = conversationId ?? activeConversationId;
          if (!targetConversationId || !user) return;

          const convo = conversations.find(
            (conversation) => conversation._id === targetConversationId,
          );
          if (!convo?.lastMessage) return;

          const senderId = getLastMessageSenderId(convo.lastMessage);

          if (!senderId || senderId === user._id) return;

          const myUnread = convo.unreadCounts?.[user._id];
          if (typeof myUnread === "number" && myUnread === 0) return;

          await chatServices.markasSeen(targetConversationId);

          set((state) => ({
            conversations: state.conversations.map((conversation) =>
              conversation._id === targetConversationId
                ? {
                    ...conversation,
                    unreadCounts: {
                      ...(conversation.unreadCounts ?? {}),
                      [user._id]: 0,
                    },
                  }
                : conversation,
            ),
          }));
        } catch (error) {
          console.error("Failed to mark as seen", error);
        }
      },

      addConvo: (convo, options) => {
        set((state) => {
          const exists = state.conversations.some(
            (conversation) => conversation._id.toString() === convo._id.toString(),
          );
          const shouldActivate = options?.activate ?? true;

          return {
            conversations: exists ? state.conversations : [convo, ...state.conversations],
            activeConversationId: shouldActivate
              ? convo._id
              : state.activeConversationId,
          };
        });
      },

      createConversation: async (type, name, memberIds) => {
        try {
          set({ loading: true });
          const conversation = await chatServices.createConversation(
            type,
            name,
            memberIds,
          );

          get().addConvo(conversation);
          useSocketStore.getState().socket?.emit("join-conversation", conversation._id);
          await get().fetchMessages(conversation._id);
          return conversation;
        } catch (error) {
          console.error("Failed to create conversation:", error);
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "chat-storage",
      partialize: (state) => ({
        conversations: state.conversations,
      }),
    },
  ),
);
