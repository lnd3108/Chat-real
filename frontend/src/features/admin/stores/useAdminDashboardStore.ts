import { adminService } from "@/features/admin/application/AdminService";
import { getAdminErrorMessage } from "@/features/admin/application/adminErrorMapper";
import { getErrorMeta, logger } from "@/shared/lib/logger";
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
      const overview = await adminService.getDashboardOverview();
      set({
        overview,
        loading: false,
        error: null,
      });
    } catch (error) {
      logger.error("Không thể tải tổng quan dashboard admin", getErrorMeta(error));
      set({
        loading: false,
        error: getAdminErrorMessage(
          error,
          "Không thể tải dữ liệu tổng quan dashboard.",
        ),
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
