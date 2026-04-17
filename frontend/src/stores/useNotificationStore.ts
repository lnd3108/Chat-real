import type { NotificationState } from "@/types/store";
import type { FriendRequest } from "@/types/user";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_NOTIFICATIONS = 100;

const buildFriendRequestNotification = (request: FriendRequest) => ({
  id: `friend-request-${request._id}`,
  type: "friend_request" as const,
  title: "Lời mời kết bạn mới",
  message: `${request.from?.displayName ?? "Ai đó"} đã gửi lời mời kết bạn cho bạn`,
  actorName: request.from?.displayName,
  entityId: request._id,
});

const sortByNewest = <
  T extends {
    createdAt: string;
  },
>(
  items: T[],
) =>
  [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      items: [],

      addNotification: (notification) => {
        set((state) => {
          const exists = state.items.some((item) => item.id === notification.id);
          if (exists) {
            return {
              items: sortByNewest(
                state.items.map((item) =>
                  item.id === notification.id
                    ? {
                        ...item,
                        ...notification,
                        createdAt: notification.createdAt ?? item.createdAt,
                        isRead: notification.isRead ?? item.isRead,
                      }
                    : item,
                ),
              ),
            };
          }

          const nextItems = sortByNewest([
            {
              ...notification,
              createdAt: notification.createdAt ?? new Date().toISOString(),
              isRead: notification.isRead ?? false,
            },
            ...state.items,
          ]).slice(0, MAX_NOTIFICATIONS);

          return { items: nextItems };
        });
      },

      syncFriendRequestNotifications: (requests: FriendRequest[]) => {
        set((state) => {
          const requestIds = new Set(requests.map((request) => request._id));

          const nonFriendRequestItems = state.items.filter(
            (item) =>
              item.type !== "friend_request" ||
              (item.entityId && requestIds.has(item.entityId)),
          );

          let nextItems = [...nonFriendRequestItems];

          requests.forEach((request) => {
            const existing = nextItems.find(
              (item) => item.id === `friend-request-${request._id}`,
            );

            if (existing) return;

            nextItems.push({
              ...buildFriendRequestNotification(request),
              createdAt: request.createdAt,
              isRead: false,
            });
          });

          return {
            items: sortByNewest(nextItems).slice(0, MAX_NOTIFICATIONS),
          };
        });
      },

      removeNotificationByEntity: (entityId) => {
        set((state) => ({
          items: state.items.filter((item) => item.entityId !== entityId),
        }));
      },

      removeNotification: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          items: state.items.map((item) => ({ ...item, isRead: true })),
        }));
      },

      unreadCount: () => get().items.filter((item) => !item.isRead).length,
    }),
    {
      name: "notification-storage",
      partialize: (state) => ({
        items: state.items,
      }),
    },
  ),
);
