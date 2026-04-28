import type {
  AdminReportRecord,
  AdminSupportConversationRecord,
  AdminSupportMessageRecord,
  AdminUserRecord,
  PaginationData,
} from "@/shared/types/admin";
import type { AdminDashboardOverview } from "@/features/admin/stores/useAdminDashboardStore";

export type AdminUserListQuery = {
  page: number;
  limit: number;
  q: string;
  status: string;
  sort: string;
};

export type AdminReportListQuery = {
  page: number;
  limit: number;
  status: string;
  targetType: string;
  q: string;
  sort: string;
};

export type AdminSupportListQuery = {
  page: number;
  limit: number;
  status: string;
  q: string;
  sort: string;
};

export interface AdminListResult<T> {
  items: T[];
  pagination: PaginationData;
}

export interface AdminSupportDetailResult {
  conversation: AdminSupportConversationRecord | null;
  messages: AdminSupportMessageRecord[];
}

export interface AdminRepository {
  listUsers(query: AdminUserListQuery): Promise<AdminListResult<AdminUserRecord>>;
  listReports(
    query: AdminReportListQuery,
  ): Promise<AdminListResult<AdminReportRecord>>;
  listSupportConversations(
    query: AdminSupportListQuery,
  ): Promise<AdminListResult<AdminSupportConversationRecord>>;
  getSupportConversationDetail(id: string): Promise<AdminSupportDetailResult>;
  getDashboardOverview(): Promise<AdminDashboardOverview>;
  getDashboardUserChart(days: 7 | 30): Promise<unknown>;
  getDashboardMessageChart(days: 7 | 30): Promise<unknown>;
  getDashboardReportChart(): Promise<unknown>;
  getDashboardSupportChart(): Promise<unknown>;
}
