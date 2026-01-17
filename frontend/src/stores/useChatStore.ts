import { chatServices } from "@/services/chatServices";
import type { ChatState } from "@/types/store";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuthStore } from "./useAuthStore";
import { useSocketStore } from "./useSocketStore";

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: {},
      activeConversationId: null,
      convoLoading: false, // convo loading
      messageLoading: false, // message loading
      loading: false, // create convo loading

      reset: () =>
        set({
          conversations: [],
          messages: {},
          activeConversationId: null,
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
        // const nextCursor =
        //   current?.nextCursor || undefined ? "" : current?.nextCursor;

        const nextCursor = current?.nextCursor ?? undefined;
        if (current && current.nextCursor === null) return; // hết trang

        if (nextCursor === null) return;

        set({ messageLoading: true });

        try {
          const { messages: fetched, cursor } =
            await chatServices.fetchMessages(convoId, nextCursor);

          const processed = fetched.map((m) => ({
            ...m,
            isOwn: m.senderId === user?._id,
          }));
          set((state) => {
            const prev = state.messages[convoId]?.items ?? [];
            const merged =
              prev.length > 0 ? [...processed, ...prev] : processed;

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  items: merged,
                  hasMore: !!cursor,
                  nextCursor: cursor ?? null,
                },
              },
            };
          });
        } catch (error) {
          console.error("Failed to fetch messages:", error);
        } finally {
          set({ messageLoading: false });
        }
      },
      sendDirectMessage: async (recipientId, content, imgUrl) => {
        try {
          const { activeConversationId, conversations } = get();
          const me = useAuthStore.getState().user?._id;

          //Nếu recipient đang undefined -> cuộc hội thoại đang active
          let finalRecipientId: string | undefined = recipientId;

          if (!finalRecipientId && activeConversationId && me) {
            const convo = conversations.find(
              (c: any) => c._id === activeConversationId
            );

            const other = convo?.participants?.find((p) => {
              const uid =
                typeof p.userId === "string" ? p.userId : p.userId._id;
              return uid !== me;
            });

            finalRecipientId =
              typeof other?.userId === "string"
                ? other.userId
                : other?.userId._id;
          }

          if (!finalRecipientId) {
            console.error("Missing recipientId: cannot send direct message");
            return;
          }

          // console.log("✅ finalRecipientId =", finalRecipientId);

          await chatServices.sendDirectMessage(
            finalRecipientId,
            content,
            imgUrl,
            activeConversationId || undefined
          );

          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === activeConversationId ? { ...c, seenBy: [] } : c
            ),
          }));
        } catch (error: any) {
          console.log("status:", error?.response?.status);
          console.log("data:", error?.response?.data);
          console.error("Lỗi xảy ra khi gửi direct message", error);
        }
      },
      sendGroupMessage: async (conversationId, content, imgUrl) => {
        try {
          await chatServices.sendGroupMessage(conversationId, content, imgUrl);
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === get().activeConversationId ? { ...c, seenBy: [] } : c
            ),
          }));
        } catch (error) {
          console.error("Lỗi xảy ra khi gửi group message", error);
        }
      },
      addMessage: async (message) => {
        try {
          const { user } = useAuthStore.getState();
          const { fetchMessages } = get();

          message.isOwn = message.senderId === user?._id;

          const convoId = message.conversationId;

          let prevItems = get().messages[convoId]?.items ?? [];
          if (prevItems.length === 0) {
            await fetchMessages(message.conversationId);
            prevItems = get().messages[convoId]?.items ?? [];
          }

          set((state) => {
            const current = state.messages[convoId] ?? {
              items: [],
              hasMore: true,
              nextCursor: null,
            };

            if (current.items.some((m) => m._id === message._id)) return state;

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  ...current,
                  items: [...current.items, message],
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi xảy ra khi add message:", error);
        }
      },
      updateConversation: async (conversation) => {
        const seenBy = (conversation?.seenBy ?? []).map((u: any) =>
          typeof u === "string" ? { _id: u } : u?._id ? { _id: u._id } : u
        );

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c._id === conversation._id ? { ...c, ...conversation, seenBy } : c
          ),
        }));
      },

      markasSeen: async () => {
        try {
          const { user } = useAuthStore.getState();
          const { activeConversationId, conversations } = get();

          if (!activeConversationId || !user) {
            return;
          }

          const convo = conversations.find(
            (c) => c._id === activeConversationId
          );

          if (!convo?.lastMessage) {
            return;
          }

          const senderId =
            (convo.lastMessage as any)?.sender?._id ??
            (convo.lastMessage as any)?.senderId;

          if (!senderId) return;
          if (senderId === user._id) return;

          const myUnread = convo.unreadCounts?.[user._id];
          if (typeof myUnread === "number" && myUnread === 0) return;

          await chatServices.markasSeen(activeConversationId);

          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === activeConversationId
                ? {
                    ...c,
                    unreadCounts: {
                      ...(c.unreadCounts ?? {}),
                      [user._id]: 0,
                    },
                  }
                : c
            ),
          }));
        } catch (error) {
          console.error("Lỗi xảy ra khi gọi markasSeen trong store", error);
        }
      },

      addConvo: (convo) => {
        set((state) => {
          const exists = state.conversations.some(
            (c) => c._id.toString() === convo._id.toString()
          );

          return {
            conversations: exists
              ? state.conversations
              : [convo, ...state.conversations],
            activeConversationId: convo._id,
          };
        });
      },

      createConversation: async (type, name, memberIds) => {
        try {
          set({ loading: true });
          const conversation = await chatServices.createConversation(
            type,
            name,
            memberIds
          );
          get().addConvo(conversation);

          useSocketStore
            .getState()
            .socket?.emit("join-conversation", conversation._id);
        } catch (error) {
          console.error("Lỗi xảy ra khi tạo cuộc trò chuyện:", error);
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
    }
  )
);
