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

const looksMojibake = (value: string) =>
  /(?:\u00c3.|\u00c6.|\u00c4.|\u00e1\u00bb|\u00e1\u00ba|\u00c2)/.test(value);

const repairVietnameseText = (value?: string | null) => {
  if (!value || !looksMojibake(value)) {
    return value ?? "";
  }

  try {
    const bytes = Uint8Array.from(
      Array.from(value).map((char) => char.charCodeAt(0) & 0xff),
    );
    const decoded = new TextDecoder("utf-8").decode(bytes);

    return decoded.includes("�") ? value : decoded;
  } catch {
    return value;
  }
};

const normalizeNotification = (item: AdminNotificationItem): AdminNotificationItem => ({
  ...item,
  title: repairVietnameseText(item.title),
  message: repairVietnameseText(item.message),
});

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
            items: sortByNewest(items).map(normalizeNotification).slice(0, 100),
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
      merge: (persisted, current) => {
        const typedPersisted = persisted as Partial<AdminNotificationState> | undefined;
        const items = (typedPersisted?.items ?? []).map(normalizeNotification);

        return {
          ...current,
          ...typedPersisted,
          items,
        };
      },
    },
  ),
);
