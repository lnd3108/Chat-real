import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AdminNotificationItem {
  id: string;
  type: "user" | "report" | "support" | "system";
  title: string;
  message: string;
  link?: string | null;
  entityId?: string | null;
  severity?: "info" | "success" | "warning" | "error";
  actor?: {
    _id?: string;
    displayName?: string;
    userName?: string;
    avatarUrl?: string | null;
  } | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  isRead: boolean;
}

interface AdminNotificationState {
  items: AdminNotificationItem[];
  addNotification: (
    notification: Omit<AdminNotificationItem, "isRead" | "createdAt"> & {
      isRead?: boolean;
      createdAt?: string;
    },
  ) => void;
  markAllAsRead: () => void;
  markAsRead: (id: string) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  unreadCount: () => number;
}

const sortByNewest = (items: AdminNotificationItem[]) =>
  [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

export const useAdminNotificationStore = create<AdminNotificationState>()(
  persist(
    (set, get) => ({
      items: [],
      addNotification: (notification) => {
        set((state) => {
          const nextItem: AdminNotificationItem = {
            ...notification,
            createdAt: notification.createdAt ?? new Date().toISOString(),
            isRead: notification.isRead ?? false,
          };

          const exists = state.items.some((item) => item.id === nextItem.id);
          const items = exists
            ? state.items.map((item) =>
                item.id === nextItem.id ? { ...item, ...nextItem } : item,
              )
            : [nextItem, ...state.items];

          return {
            items: sortByNewest(items).slice(0, 100),
          };
        });
      },
      markAllAsRead: () => {
        set((state) => ({
          items: state.items.map((item) => ({ ...item, isRead: true })),
        }));
      },
      markAsRead: (id) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, isRead: true } : item,
          ),
        }));
      },
      removeNotification: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },
      clearAll: () => set({ items: [] }),
      unreadCount: () => get().items.filter((item) => !item.isRead).length,
    }),
    {
      name: "admin-notification-storage",
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
