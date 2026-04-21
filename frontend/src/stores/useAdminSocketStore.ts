import { axiosInstance } from "@/lib/axios";
import { getErrorMeta, logger } from "@/lib/logger";
import { APP_ROLES } from "@/lib/rbac";
import type {
  AdminReportRecord,
  AdminSupportConversationRecord,
  AdminSupportMessageRecord,
  AdminUserRecord,
  PaginationData,
} from "@/types/admin";
import { create } from "zustand";

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

interface AdminSocketState {
  boundSocketId: string | null;
  users: AdminUserRecord[];
  usersLoading: boolean;
  usersPagination: PaginationData;
  userQuery: UserListQuery;
  reports: AdminReportRecord[];
  reportsLoading: boolean;
  reportsPagination: PaginationData;
  reportQuery: ReportListQuery;
  supportConversations: AdminSupportConversationRecord[];
  supportLoading: boolean;
  supportPagination: PaginationData;
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

const defaultPagination: PaginationData = {
  page: 1,
  limit: 20,
  total: 0,
  pages: 1,
};

const getItemTimestamp = (item: { updatedAt?: string; createdAt?: string }) =>
  new Date(item.updatedAt ?? item.createdAt ?? 0).getTime();

const upsertById = <T extends { _id: string; updatedAt?: string; createdAt?: string }>(
  items: T[],
  incoming: T,
) => {
  const exists = items.some((item) => item._id === incoming._id);
  const next = exists
    ? items.map((item) => (item._id === incoming._id ? { ...item, ...incoming } : item))
    : [incoming, ...items];

  return [...next].sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));
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
      logger.error("Khong the tai danh sach nguoi dung admin", getErrorMeta(error));
      set({ usersLoading: false });
      throw error;
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
      logger.error("Khong the tai danh sach bao cao admin", getErrorMeta(error));
      set({ reportsLoading: false });
      throw error;
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
      logger.error("Khong the tai danh sach hoi thoai ho tro admin", getErrorMeta(error));
      set({ supportLoading: false });
      throw error;
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
        role: APP_ROLES.USER,
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
