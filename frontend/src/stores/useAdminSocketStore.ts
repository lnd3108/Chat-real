import { axiosInstance } from "@/lib/axios";
import { create } from "zustand";

type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

type UserListQuery = {
  page: number;
  limit: number;
  q: string;
  status: string;
  sort: string;
};

type ReportListQuery = {
  page: number;
  limit: number;
  status: string;
  targetType: string;
  q: string;
  sort: string;
};

type SupportListQuery = {
  page: number;
  limit: number;
  status: string;
  q: string;
  sort: string;
};

export interface AdminUserRecord {
  _id: string;
  displayName: string;
  userName: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "inactive" | "suspended" | "banned";
  avatarUrl?: string | null;
  createdAt: string;
  isOnline?: boolean;
}

export interface AdminReportRecord {
  _id: string;
  reporterSnapshot: {
    _id: string;
    displayName: string;
    userName: string;
    avatarUrl?: string;
  };
  targetType: "user" | "message" | "conversation";
  reason: string;
  status: "pending" | "reviewing" | "resolved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

export interface AdminSupportConversationRecord {
  _id: string;
  supportStatus: "open" | "in_progress" | "resolved" | "closed";
  supportCreatedByUserId: string;
  supportCreatedByUser?: {
    _id: string;
    displayName: string;
    userName: string;
    email?: string;
    avatarUrl?: string;
  };
  assignedAdminId?: string | null;
  assignedAdmin?: {
    _id: string;
    displayName: string;
  } | null;
  lastMessage?: {
    _id?: string;
    content?: string;
    senderDisplayName?: string;
    createdAt?: string;
  };
  unreadCounts?: Record<string, number>;
  updatedAt: string;
  createdAt: string;
}

export interface AdminSupportMessageRecord {
  _id: string;
  conversationId: string;
  senderId: string;
  senderDisplayName?: string;
  senderAvatar?: string | null;
  content: string;
  createdAt: string;
  type?: string;
}

interface AdminSocketState {
  boundSocketId: string | null;
  users: AdminUserRecord[];
  usersLoading: boolean;
  usersPagination: Pagination;
  userQuery: UserListQuery;
  reports: AdminReportRecord[];
  reportsLoading: boolean;
  reportsPagination: Pagination;
  reportQuery: ReportListQuery;
  supportConversations: AdminSupportConversationRecord[];
  supportLoading: boolean;
  supportPagination: Pagination;
  supportQuery: SupportListQuery;
  supportMessagesByConversation: Record<string, AdminSupportMessageRecord[]>;
  activeSupportConversationId: string | null;
  setBoundSocketId: (socketId: string | null) => void;
  fetchUsers: (query: Partial<UserListQuery>) => Promise<void>;
  fetchReports: (query: Partial<ReportListQuery>) => Promise<void>;
  fetchSupportConversations: (query: Partial<SupportListQuery>) => Promise<void>;
  fetchSupportConversationDetail: (
    id: string,
  ) => Promise<{
    conversation: AdminSupportConversationRecord | null;
    messages: AdminSupportMessageRecord[];
  }>;
  setActiveSupportConversationId: (id: string | null) => void;
  upsertUser: (user: Partial<AdminUserRecord> & { _id: string }) => void;
  removeUser: (userId: string) => void;
  upsertReport: (report: AdminReportRecord) => void;
  upsertSupportConversation: (conversation: AdminSupportConversationRecord) => void;
  upsertSupportMessage: (
    conversationId: string,
    message: AdminSupportMessageRecord,
  ) => void;
}

const defaultPagination: Pagination = {
  page: 1,
  limit: 20,
  total: 0,
  pages: 1,
};

const upsertById = <T extends { _id: string }>(items: T[], incoming: T) => {
  const exists = items.some((item) => item._id === incoming._id);
  const next = exists
    ? items.map((item) => (item._id === incoming._id ? { ...item, ...incoming } : item))
    : [incoming, ...items];

  return [...next].sort((a, b) => {
    const aTime = new Date((a as { updatedAt?: string; createdAt?: string }).updatedAt ?? (a as { createdAt?: string }).createdAt ?? 0).getTime();
    const bTime = new Date((b as { updatedAt?: string; createdAt?: string }).updatedAt ?? (b as { createdAt?: string }).createdAt ?? 0).getTime();
    return bTime - aTime;
  });
};

export const useAdminSocketStore = create<AdminSocketState>((set, get) => ({
  boundSocketId: null,
  users: [],
  usersLoading: false,
  usersPagination: defaultPagination,
  userQuery: { page: 1, limit: 20, q: "", status: "", sort: "createdAt" },
  reports: [],
  reportsLoading: false,
  reportsPagination: defaultPagination,
  reportQuery: {
    page: 1,
    limit: 20,
    status: "",
    targetType: "",
    q: "",
    sort: "createdAt-desc",
  },
  supportConversations: [],
  supportLoading: false,
  supportPagination: defaultPagination,
  supportQuery: {
    page: 1,
    limit: 20,
    status: "",
    q: "",
    sort: "updatedAt-desc",
  },
  supportMessagesByConversation: {},
  activeSupportConversationId: null,
  setBoundSocketId: (socketId) => set({ boundSocketId: socketId }),
  fetchUsers: async (query) => {
    const nextQuery = { ...get().userQuery, ...query };
    try {
      set({ usersLoading: true, userQuery: nextQuery });
      const response = await axiosInstance.get("/admin/users", {
        params: nextQuery,
      });
      set({
        users: response.data.data.users ?? [],
        usersPagination: response.data.data.pagination ?? defaultPagination,
        usersLoading: false,
      });
    } catch (error) {
      console.error("Failed to fetch admin users:", error);
      set({ usersLoading: false });
    }
  },
  fetchReports: async (query) => {
    const nextQuery = { ...get().reportQuery, ...query };
    try {
      set({ reportsLoading: true, reportQuery: nextQuery });
      const response = await axiosInstance.get("/admin/reports", {
        params: nextQuery,
      });
      set({
        reports: response.data.data.reports ?? [],
        reportsPagination: response.data.data.pagination ?? defaultPagination,
        reportsLoading: false,
      });
    } catch (error) {
      console.error("Failed to fetch admin reports:", error);
      set({ reportsLoading: false });
    }
  },
  fetchSupportConversations: async (query) => {
    const nextQuery = { ...get().supportQuery, ...query };
    try {
      set({ supportLoading: true, supportQuery: nextQuery });
      const response = await axiosInstance.get("/admin/support/conversations", {
        params: nextQuery,
      });
      set({
        supportConversations: response.data.data.conversations ?? [],
        supportPagination: response.data.data.pagination ?? defaultPagination,
        supportLoading: false,
      });
    } catch (error) {
      console.error("Failed to fetch admin support conversations:", error);
      set({ supportLoading: false });
    }
  },
  fetchSupportConversationDetail: async (id) => {
    const response = await axiosInstance.get(`/admin/support/conversations/${id}`);
    const conversation = response.data.data.conversation ?? null;
    const messages = response.data.data.messages ?? [];

    if (conversation) {
      get().upsertSupportConversation(conversation);
    }

    set((state) => ({
      supportMessagesByConversation: {
        ...state.supportMessagesByConversation,
        [id]: messages,
      },
    }));

    return { conversation, messages };
  },
  setActiveSupportConversationId: (id) => set({ activeSupportConversationId: id }),
  upsertUser: (user) => {
    set((state) => ({
      users: upsertById(state.users, {
        role: "user",
        status: "active",
        email: "",
        displayName: "",
        userName: "",
        createdAt: new Date().toISOString(),
        ...user,
      }),
    }));
  },
  removeUser: (userId) => {
    set((state) => ({
      users: state.users.filter((item) => item._id !== userId),
    }));
  },
  upsertReport: (report) => {
    set((state) => ({
      reports: upsertById(state.reports, report),
    }));
  },
  upsertSupportConversation: (conversation) => {
    set((state) => ({
      supportConversations: upsertById(state.supportConversations, conversation),
    }));
  },
  upsertSupportMessage: (conversationId, message) => {
    set((state) => {
      const current = state.supportMessagesByConversation[conversationId] ?? [];
      const exists = current.some((item) => item._id === message._id);

      return {
        supportMessagesByConversation: {
          ...state.supportMessagesByConversation,
          [conversationId]: exists ? current : [...current, message],
        },
      };
    });
  },
}));
