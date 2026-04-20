import { axiosInstance } from "@/lib/axios";
import { create } from "zustand";

export interface AdminDashboardOverview {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  deletedUsers: number;
  newUsersLast7Days: number;
  totalDirectConversations: number;
  totalGroupConversations: number;
  totalSupportConversations: number;
  totalMessages: number;
  newGroupsLast7Days: number;
  totalAcceptedFriends: number;
  totalPendingFriendRequests: number;
  totalActiveBlocks: number;
  totalPendingReports: number;
  totalReviewingReports: number;
  totalOpenSupportConversations: number;
  totalInProgressSupportConversations: number;
  totalOnlineUsers?: number;
  newUsersToday?: number;
  totalUnreadSupportConversations?: number;
  latestUsers?: Array<{
    _id: string;
    displayName: string;
    userName: string;
    avatarUrl?: string | null;
    status: string;
    createdAt: string;
  }>;
  maintenance?: {
    isEnabled: boolean;
    message: string;
    enabledAt: string | null;
    disabledAt: string | null;
    actor?: {
      _id?: string;
      displayName?: string;
      userName?: string;
    } | null;
  };
}

interface AdminDashboardState {
  overview: AdminDashboardOverview | null;
  loading: boolean;
  error: string | null;
  fetchOverview: () => Promise<void>;
  applyRealtimeStats: (payload: Partial<AdminDashboardOverview>) => void;
}

export const useAdminDashboardStore = create<AdminDashboardState>((set) => ({
  overview: null,
  loading: false,
  error: null,
  fetchOverview: async () => {
    try {
      set({ loading: true, error: null });
      const response = await axiosInstance.get("/admin/dashboard/overview");
      set({
        overview: response.data.data,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Failed to fetch admin dashboard overview:", error);
      set({
        loading: false,
        error: "Khong the tai du lieu tong quan dashboard.",
      });
    }
  },
  applyRealtimeStats: (payload) => {
    set((state) => ({
      overview: state.overview
        ? {
            ...state.overview,
            ...payload,
            maintenance: payload.maintenance ?? state.overview.maintenance,
            latestUsers: payload.latestUsers ?? state.overview.latestUsers,
          }
        : (payload as AdminDashboardOverview),
    }));
  },
}));
