import type {
  AdminListResult,
  AdminRepository,
  AdminReportListQuery,
  AdminSupportDetailResult,
  AdminSupportListQuery,
  AdminUserListQuery,
} from "@/features/admin/data/AdminRepository";
import { AdminApiRepository } from "@/features/admin/data/AdminApiRepository";
import type {
  AdminReportRecord,
  AdminSupportConversationRecord,
  AdminUserRecord,
  PaginationData,
} from "@/shared/types/admin";

export const defaultAdminPagination: PaginationData = {
  page: 1,
  limit: 20,
  total: 0,
  pages: 1,
};

export class AdminService {
  private readonly repository: AdminRepository;

  constructor(repository: AdminRepository) {
    this.repository = repository;
  }

  async listUsers(
    query: AdminUserListQuery,
  ): Promise<AdminListResult<AdminUserRecord>> {
    const result = await this.repository.listUsers(query);
    return this.withPaginationFallback(result);
  }

  async listReports(
    query: AdminReportListQuery,
  ): Promise<AdminListResult<AdminReportRecord>> {
    const result = await this.repository.listReports(query);
    return this.withPaginationFallback(result);
  }

  async listSupportConversations(
    query: AdminSupportListQuery,
  ): Promise<AdminListResult<AdminSupportConversationRecord>> {
    const result = await this.repository.listSupportConversations(query);
    return this.withPaginationFallback(result);
  }

  getSupportConversationDetail(id: string): Promise<AdminSupportDetailResult> {
    return this.repository.getSupportConversationDetail(id);
  }

  getDashboardOverview() {
    return this.repository.getDashboardOverview();
  }

  getDashboardUserChart(days: 7 | 30) {
    return this.repository.getDashboardUserChart(days);
  }

  getDashboardMessageChart(days: 7 | 30) {
    return this.repository.getDashboardMessageChart(days);
  }

  getDashboardReportChart() {
    return this.repository.getDashboardReportChart();
  }

  getDashboardSupportChart() {
    return this.repository.getDashboardSupportChart();
  }

  private withPaginationFallback<T>(result: AdminListResult<T>): AdminListResult<T> {
    return {
      ...result,
      pagination: result.pagination ?? defaultAdminPagination,
    };
  }
}

export const adminService = new AdminService(new AdminApiRepository());
