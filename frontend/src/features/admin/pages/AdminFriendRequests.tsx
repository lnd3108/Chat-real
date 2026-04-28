import { useEffect, useState } from "react";
import { getErrorMeta, logger } from "@/shared/lib/logger";
import { Search } from "lucide-react";

import AdminPagination from "@/features/admin/components/AdminPagination";
import UserAvatar from "@/features/chat/components/UserAvatar";
import { Input } from "@/shared/ui/input";
import { LoadingSpinner } from "@/shared/ui/loading-spinner";
import { axiosInstance } from "@/shared/api/axios";

type FriendRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";

interface UserSummary {
  _id: string;
  displayName: string;
  userName: string;
  email: string | null;
  avatarUrl?: string | null;
}

interface FriendRequestRow {
  _id: string;
  fromUser: UserSummary | null;
  toUser: UserSummary | null;
  message: string;
  status: FriendRequestStatus;
  createdAt: string;
  updatedAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const statusConfig: Record<FriendRequestStatus, { label: string; className: string }> = {
  pending: {
    label: "Chờ xử lý",
    className: "bg-amber-500/10 text-amber-700",
  },
  accepted: {
    label: "Đã chấp nhận",
    className: "bg-emerald-500/10 text-emerald-700",
  },
  rejected: {
    label: "Từ chối",
    className: "bg-rose-500/10 text-rose-700",
  },
  cancelled: {
    label: "Đã hủy",
    className: "bg-slate-500/10 text-slate-700",
  },
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

const UserCell = ({
  user,
  fallback,
}: {
  user: UserSummary | null;
  fallback: string;
}) => {
  if (!user) {
    return <span className="text-sm text-muted-foreground">{fallback}</span>;
  }

  return (
    <div className="flex items-center gap-3">
      <UserAvatar
        type="chat"
        name={user.displayName}
        avatarUrl={user.avatarUrl ?? undefined}
        className="size-10"
      />
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{user.displayName}</p>
        <p className="truncate text-sm text-muted-foreground">@{user.userName}</p>
      </div>
    </div>
  );
};

const AdminFriendRequests = () => {
  const [requests, setRequests] = useState<FriendRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | FriendRequestStatus>("");
  const [sortBy, setSortBy] = useState("createdAt-desc");
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });

  useEffect(() => {
    void fetchRequests();
  }, [page, searchQuery, statusFilter, sortBy]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axiosInstance.get("/admin/friend-requests", {
        params: {
          page,
          limit: 20,
          q: searchQuery,
          status: statusFilter,
          sort: sortBy,
        },
      });

      setRequests(response.data.data.requests ?? []);
      setPagination(response.data.data.pagination);
    } catch (err) {
      logger.error("Khong the tai danh sach loi moi ket ban admin", getErrorMeta(err));
      setError("Không thể tải danh sách lời mời kết bạn.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleStatusChange = (value: "" | FriendRequestStatus) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    setPage(1);
  };

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Lời mời kết bạn</h1>
          <p className="mt-2 text-muted-foreground">
            Xem danh sách lời mời kết bạn và trạng thái của chúng.
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
        <h1 className="text-3xl font-bold text-foreground">Lời mời kết bạn</h1>
        <p className="mt-2 text-muted-foreground">
          Tổng cộng {pagination.total} lời mời kết bạn trong hệ thống.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo username hoặc displayName..."
              value={searchQuery}
              onChange={(event) => handleSearch(event.target.value)}
              className="border-border/50 bg-muted/50 pl-10 focus:border-primary/50"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => handleStatusChange(event.target.value as "" | FriendRequestStatus)}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xử lý</option>
            <option value="accepted">Đã chấp nhận</option>
            <option value="rejected">Từ chối</option>
            <option value="cancelled">Đã hủy</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => handleSortChange(event.target.value)}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="createdAt-desc">Mới nhất</option>
            <option value="createdAt-asc">Cũ nhất</option>
            <option value="updatedAt-desc">Cập nhật gần nhất</option>
            <option value="status">Theo trạng thái</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">Không có lời mời kết bạn nào phù hợp.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Thử thay đổi trạng thái lọc hoặc từ khóa tìm kiếm.
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
                      Người gửi
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Người nhận
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Lời nhắn
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Trạng thái
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Tạo lúc
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr
                      key={request._id}
                      className="border-b border-border/50 transition-colors hover:bg-muted/30"
                    >
                      <td className="px-6 py-4">
                        <UserCell user={request.fromUser} fallback="Người gửi đã bị xóa" />
                      </td>
                      <td className="px-6 py-4">
                        <UserCell user={request.toUser} fallback="Người nhận đã bị xóa" />
                      </td>
                      <td className="max-w-[280px] px-6 py-4 text-sm text-muted-foreground">
                        <span className="line-clamp-2">
                          {request.message?.trim() || "Không có lời giới thiệu"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                            statusConfig[request.status].className
                          }`}
                        >
                          {statusConfig[request.status].label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatDate(request.createdAt)}
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

export default AdminFriendRequests;
