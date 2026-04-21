import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AlertCircle, Eye, Flag, Search } from "lucide-react";

import AdminPagination from "@/components/admin/AdminPagination";
import UserAvatar from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { getErrorMessage } from "@/lib/httpError";
import { useAdminSocketStore } from "@/stores/useAdminSocketStore";
import type {
  AdminReportRecord,
  AdminReportStatus,
  AdminReportTargetType,
  PaginationData,
} from "@/types/admin";

const statusConfig: Record<AdminReportStatus, { label: string; className: string }> = {
  pending: { label: "Chờ xử lý", className: "bg-yellow-500/10 text-yellow-700" },
  reviewing: { label: "Đang xem xét", className: "bg-blue-500/10 text-blue-700" },
  resolved: { label: "Đã xử lý", className: "bg-emerald-500/10 text-emerald-700" },
  rejected: { label: "Từ chối", className: "bg-red-500/10 text-red-700" },
};

const typeConfig: Record<AdminReportTargetType, { label: string; className: string }> = {
  user: { label: "Báo cáo người dùng", className: "bg-purple-500/10 text-purple-700" },
  message: { label: "Báo cáo tin nhắn", className: "bg-blue-500/10 text-blue-700" },
  conversation: {
    label: "Báo cáo cuộc trò chuyện",
    className: "bg-amber-500/10 text-amber-700",
  },
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) {
    return "Không có ngày";
  }

  return new Date(dateString).toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AdminReports = () => {
  const navigate = useNavigate();
  const reports = useAdminSocketStore((state) => state.reports as AdminReportRecord[]);
  const loading = useAdminSocketStore((state) => state.reportsLoading);
  const pagination = useAdminSocketStore(
    (state) => state.reportsPagination as PaginationData,
  );
  const fetchReportsFromStore = useAdminSocketStore((state) => state.fetchReports);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"" | AdminReportStatus>("");
  const [typeFilter, setTypeFilter] = useState<"" | AdminReportTargetType>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("createdAt-desc");

  const fetchReports = useCallback(async () => {
    try {
      setError(null);
      await fetchReportsFromStore({
        page,
        limit: 20,
        status: statusFilter,
        targetType: typeFilter,
        q: searchQuery,
        sort: sortBy,
      });
    } catch (err) {
      console.error("[report][admin-page][error]", err);
      setError(getErrorMessage(err, "Không thể tải danh sách báo cáo."));
    }
  }, [fetchReportsFromStore, page, searchQuery, sortBy, statusFilter, typeFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchReports();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchReports]);

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quản lý báo cáo</h1>
          <p className="mt-2 text-muted-foreground">
            Quản lý và xem xét báo cáo từ người dùng để kiểm duyệt nội dung.
          </p>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Quản lý báo cáo</h1>
        <p className="mt-2 text-muted-foreground">
          Tổng cộng {pagination.total} báo cáo cần theo dõi và xử lý.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-amber-700" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Lưu ý quyền riêng tư</p>
            <p className="text-sm text-muted-foreground">
              Admin chỉ được xem nội dung liên quan đến báo cáo cụ thể. Không được duyệt
              hàng loạt tin nhắn người dùng ngoài phạm vi báo cáo.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo lý do hoặc người báo cáo..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              className="border-border/50 bg-muted/50 pl-10 focus:border-primary/50"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as "" | AdminReportStatus);
              setPage(1);
            }}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xử lý</option>
            <option value="reviewing">Đang xem xét</option>
            <option value="resolved">Đã xử lý</option>
            <option value="rejected">Từ chối</option>
          </select>

          <select
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value as "" | AdminReportTargetType);
              setPage(1);
            }}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="">Tất cả loại</option>
            <option value="user">Người dùng</option>
            <option value="message">Tin nhắn</option>
            <option value="conversation">Cuộc trò chuyện</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="createdAt-desc">Mới nhất</option>
            <option value="createdAt-asc">Cũ nhất</option>
            <option value="updated">Cập nhật gần đây</option>
            <option value="status">Theo trạng thái</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <Flag className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">Không tìm thấy báo cáo nào.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Người báo cáo
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Loại
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Lý do
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Trạng thái
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Tạo lúc
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr
                      key={report._id}
                      className="border-b border-border/50 transition-colors hover:bg-muted/30"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            type="chat"
                            name={report.reporterSnapshot.displayName}
                            avatarUrl={report.reporterSnapshot.avatarUrl}
                            className="size-9"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {report.reporterSnapshot.displayName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              @{report.reporterSnapshot.userName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${typeConfig[report.targetType].className}`}
                        >
                          {typeConfig[report.targetType].label}
                        </span>
                      </td>
                      <td className="max-w-[300px] px-6 py-4 text-sm text-muted-foreground">
                        <span className="line-clamp-2">{report.reason}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusConfig[report.status].className}`}
                        >
                          {statusConfig[report.status].label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatDate(report.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-10 rounded-xl border border-border/50 bg-background/40 px-3 text-muted-foreground hover:bg-background/70 hover:text-foreground"
                          onClick={() => navigate(`/admin/reports/${report._id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Xem
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <AdminPagination
              page={pagination.page}
              pages={pagination.pages}
              onPrevious={() => setPage(page - 1)}
              onNext={() => setPage(page + 1)}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default AdminReports;
