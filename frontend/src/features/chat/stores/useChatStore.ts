import { chatServices } from "@/features/chat/services/chatServices";
import type { ChatState } from "@/shared/types/store";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import { getErrorMessage } from "@/shared/lib/httpError";
import { getErrorMeta, logger } from "@/shared/lib/logger";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useNotificationStore } from "@/features/notification/stores/useNotificationStore";
import { useSocketStore } from "@/shared/realtime/useSocketStore";

const inflightMessageFetches = new Map<string, Promise<void>>();

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
        {
          inflightMessageFetches.clear();
          set({
            conversations: [],
            messages: {},
            activeConversationId: null,
            replyingTo: null,
            editingMessage: null,
            convoLoading: false,
            messageLoading: false,
          });
        },
      setActiveConversation: (id) => set({ activeConversationId: id }),

      fetchConversations: async () => {
        const { accessToken } = useAuthStore.getState();
        if (!accessToken) {
          return;
        }

        try {
          set({ convoLoading: true });
          const { conversations } = await chatServices.fetchConversations();
          set((state) => {
            return {
              conversations: chatServices.mergeConversationsById(
                state.conversations,
                conversations,
              ),
              convoLoading: false,
            };
          });
        } catch (error) {
          // Only log error if user still has access token
          if (useAuthStore.getState().accessToken) {
            logger.error("Khong the tai danh sach cuoc tro chuyen", getErrorMeta(error));
          }
          set({ convoLoading: false });
        }
      },

      fetchMessages: async (conversationId?: string) => {
        const { activeConversationId, messages } = get();
        const { user, accessToken } = useAuthStore.getState();
        const convoId = conversationId ?? activeConversationId;

        if (!convoId || !accessToken) return;

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
              chatServices.normalizeIncomingMessage(message, user?._id),
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
            if (useAuthStore.getState().accessToken) {
              logger.error("Khong the tai tin nhan", getErrorMeta(error));
            }
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

          const finalRecipientId = chatServices.resolveDirectRecipientId({
            recipientId,
            activeConversationId,
            conversations,
            currentUserId: me,
          });

          if (!finalRecipientId) {
            logger.warn("Khong the gui tin nhan truc tiep do thieu recipientId");
            return;
          }

          const response = await chatServices.sendDirectMessage(
            finalRecipientId,
            content,
            imgUrl,
            activeConversationId || undefined,
            replyingTo?._id,
          );

          const { message, conversation } = response;
          const targetConversationId = message.conversationId;

          if (targetConversationId) {
            if (conversation?._id === targetConversationId) {
              get().addConvo(conversation);
            } else {
              await get().fetchConversations();
            }

            useSocketStore.getState().socket?.emit("join-conversation", targetConversationId);
            get().setActiveConversation(targetConversationId);

            if (!get().messages[targetConversationId]) {
              await get().fetchMessages(targetConversationId);
            }
          }

          set((state) => ({
            conversations: state.conversations.map((conversation) =>
              conversation._id === (targetConversationId ?? activeConversationId)
                ? { ...conversation, seenBy: [] }
                : conversation,
            ),
            replyingTo: null,
          }));
        } catch (error: unknown) {
          logger.error("Khong the gui tin nhan truc tiep", getErrorMeta(error));
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

          const finalRecipientId = chatServices.resolveDirectRecipientId({
            recipientId,
            activeConversationId,
            conversations,
            currentUserId: me,
          });

          if (!finalRecipientId) {
            logger.warn("Khong the gui anh truc tiep do thieu recipientId");
            return;
          }

          const response = await chatServices.sendDirectMessageWithImage(
            finalRecipientId,
            image,
            content,
            activeConversationId || undefined,
            replyingTo?._id,
            options?.onUploadProgress,
          );

          const { message, conversation } = response;
          const targetConversationId = message.conversationId;

          if (targetConversationId) {
            if (conversation?._id === targetConversationId) {
              get().addConvo(conversation);
            } else {
              await get().fetchConversations();
            }

            useSocketStore.getState().socket?.emit("join-conversation", targetConversationId);
            get().setActiveConversation(targetConversationId);

            if (!get().messages[targetConversationId]) {
              await get().fetchMessages(targetConversationId);
            }
          }

          set((state) => ({
            conversations: state.conversations.map((conversation) =>
              conversation._id === (targetConversationId ?? activeConversationId)
                ? { ...conversation, seenBy: [] }
                : conversation,
            ),
            replyingTo: null,
          }));
        } catch (error) {
          logger.error("Khong the gui anh truc tiep", getErrorMeta(error));
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
          logger.error("Khong the gui tin nhan nhom", getErrorMeta(error));
          throw error;
        }
      },

      sendSupportMessage: async (conversationId, content) => {
        try {
          const { message, conversation } = await chatServices.sendSupportMessage(
            conversationId,
            content,
          );

          get().addConvo(conversation, { activate: false });
          await get().addMessage(message);
          set((state) => ({
            conversations: state.conversations.map((item) =>
              item._id === conversationId ? { ...item, unreadCounts: conversation.unreadCounts } : item,
            ),
            replyingTo: null,
          }));
        } catch (error) {
          logger.error("Khong the gui tin nhan ho tro", getErrorMeta(error));
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
          logger.error("Khong the gui anh trong nhom", getErrorMeta(error));
          throw error;
        }
      },

      editMessage: async (messageId, content) => {
        try {
          const message = await chatServices.editMessage(messageId, content);
          get().updateMessage(message);
          set({ editingMessage: null });
        } catch (error) {
          logger.error("Khong the chinh sua tin nhan", getErrorMeta(error));
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
          logger.error("Khong the xoa tin nhan o phia nguoi dung", getErrorMeta(error));
          toast.error("Không thể xóa tin nhắn ở phía bạn.");
          throw error;
        }
      },

      deleteMessageForEveryone: async (messageId) => {
        try {
          const message = await chatServices.deleteMessageForEveryone(messageId);
          get().updateMessage(message);
        } catch (error) {
          logger.error("Khong the thu hoi tin nhan", getErrorMeta(error));
          toast.error("Không thể thu hồi tin nhắn lúc này.");
          throw error;
        }
      },

      toggleReaction: async (messageId, emoji) => {
        try {
          const message = await chatServices.toggleReaction(messageId, emoji);
          get().updateMessage(message);
        } catch (error) {
          logger.error("Không thể cập nhật reaction", getErrorMeta(error));
        }
      },

      addMessage: async (message) => {
        try {
          const { user } = useAuthStore.getState();
          const normalized = chatServices.normalizeIncomingMessage(message, user?._id);
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
          logger.error("Khong the them tin nhan vao store", getErrorMeta(error));
        }
      },

      updateMessage: (message) => {
        const { user } = useAuthStore.getState();
        const normalized = chatServices.normalizeIncomingMessage(message, user?._id);
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
        set((state) => {
          const currentIndex = state.conversations.findIndex(
            (item) => item._id === conversation._id,
          );

          if (currentIndex === -1) {
            return { conversations: state.conversations };
          }

          const current = state.conversations[currentIndex];
          const merged = chatServices.mergeConversationPatch(current, conversation);

          const nextConversations = [...state.conversations];
          nextConversations[currentIndex] = merged;

          const shouldMoveToTop =
            conversation.moveToTop ??
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
          logger.error("Khong the roi hoac xoa cuoc tro chuyen nhom", getErrorMeta(error));
        }
      },

      markasSeen: async (conversationId?: string | null) => {
        try {
          const { user } = useAuthStore.getState();
          const { activeConversationId, conversations } = get();
          const targetConversationId = conversationId ?? activeConversationId;
          if (!targetConversationId || !user) return;

          useNotificationStore
            .getState()
            .markConversationNotificationsAsRead(targetConversationId);

          const convo = conversations.find(
            (conversation) => conversation._id === targetConversationId,
          );
          if (
            !chatServices.shouldMarkConversationSeen({
              conversation: convo,
              currentUserId: user._id,
            })
          ) {
            return;
          }

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
          logger.error("Khong the danh dau da xem", getErrorMeta(error));
        }
      },

      addConvo: (convo, options) => {
        set((state) => {
          const shouldActivate = options?.activate ?? true;

          return {
            conversations: chatServices.mergeConversationsById(
              state.conversations,
              [convo],
            ),
            activeConversationId: shouldActivate
              ? convo._id
              : state.activeConversationId,
          };
        });
      },

      getOrCreateSupportConversation: async () => {
        try {
          set({ loading: true });
          const conversation = await chatServices.getOrCreateSupportConversation();
          get().addConvo(conversation);
          useSocketStore.getState().socket?.emit("join-conversation", conversation._id);

          if (!get().messages[conversation._id]) {
            await get().fetchMessages(conversation._id);
          }

          return conversation;
        } catch (error) {
          logger.warn("Failed to get or create support conversation", {
            message: getErrorMessage(
              error,
              "Khong the tao cuoc tro chuyen ho tro luc nay.",
            ),
          });
          throw error;
        } finally {
          set({ loading: false });
        }
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
        } catch (error) {
          logger.error("Khong the tao cuoc tro chuyen", getErrorMeta(error));
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
