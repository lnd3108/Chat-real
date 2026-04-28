import { axiosInstance } from "@/shared/api/axios";
import type {
  AdminListResult,
  AdminRepository,
  AdminReportListQuery,
  AdminSupportDetailResult,
  AdminSupportListQuery,
  AdminUserListQuery,
} from "@/features/admin/data/AdminRepository";
import type {
  AdminReportRecord,
  AdminSupportConversationRecord,
  AdminUserRecord,
} from "@/shared/types/admin";
import type { AdminDashboardOverview } from "@/features/admin/stores/useAdminDashboardStore";

const pickPagination = (data: any) => data?.pagination;

export class AdminApiRepository implements AdminRepository {
  async listUsers(
    query: AdminUserListQuery,
  ): Promise<AdminListResult<AdminUserRecord>> {
    const response = await axiosInstance.get("/admin/users", { params: query });
    return {
      items: response.data.data.users ?? [],
      pagination: pickPagination(response.data.data),
    };
  }

  async listReports(
    query: AdminReportListQuery,
  ): Promise<AdminListResult<AdminReportRecord>> {
    const response = await axiosInstance.get("/admin/reports", { params: query });
    return {
      items: response.data.data.reports ?? [],
      pagination: pickPagination(response.data.data),
    };
  }

  async listSupportConversations(
    query: AdminSupportListQuery,
  ): Promise<AdminListResult<AdminSupportConversationRecord>> {
    const response = await axiosInstance.get("/admin/support/conversations", {
      params: query,
    });
    return {
      items: response.data.data.conversations ?? [],
      pagination: pickPagination(response.data.data),
    };
  }

  async getSupportConversationDetail(id: string): Promise<AdminSupportDetailResult> {
    const response = await axiosInstance.get(`/admin/support/conversations/${id}`);
    return {
      conversation: response.data.data.conversation ?? null,
      messages: response.data.data.messages ?? [],
    };
  }

  async getDashboardOverview(): Promise<AdminDashboardOverview> {
    const response = await axiosInstance.get("/admin/dashboard/overview");
    return response.data.data;
  }

  async getDashboardUserChart(days: 7 | 30) {
    const response = await axiosInstance.get("/admin/dashboard/charts/users", {
      params: { days },
    });
    return response.data.data;
  }

  async getDashboardMessageChart(days: 7 | 30) {
    const response = await axiosInstance.get("/admin/dashboard/charts/messages", {
      params: { days },
    });
    return response.data.data;
  }

  async getDashboardReportChart() {
    const response = await axiosInstance.get("/admin/dashboard/charts/reports");
    return response.data.data;
  }

  async getDashboardSupportChart() {
    const response = await axiosInstance.get("/admin/dashboard/charts/support");
    return response.data.data;
  }
}
