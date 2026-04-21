import { useEffect, useState } from "react";
import { getErrorMeta, logger } from "@/lib/logger";
import { Search } from "lucide-react";

import AdminPagination from "@/components/admin/AdminPagination";
import UserAvatar from "@/components/chat/UserAvatar";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { axiosInstance } from "@/lib/axios";

interface UserSummary {
  _id: string;
  displayName: string;
  userName: string;
  email: string | null;
  avatarUrl?: string | null;
}

interface FriendshipRow {
  _id: string;
  userA: UserSummary | null;
  userB: UserSummary | null;
  status: "accepted";
  createdAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const statusConfig = {
  accepted: {
    label: "Đã chấp nhận",
    className: "bg-emerald-500/10 text-emerald-700",
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

const AdminFriends = () => {
  const [friendships, setFriendships] = useState<FriendshipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("createdAt-desc");
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });

  useEffect(() => {
    void fetchFriendships();
  }, [page, searchQuery, sortBy]);

  const fetchFriendships = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axiosInstance.get("/admin/friends", {
        params: {
          page,
          limit: 20,
          q: searchQuery,
          sort: sortBy,
        },
      });

      setFriendships(response.data.data.friendships ?? []);
      setPagination(response.data.data.pagination);
    } catch (err) {
      logger.error("Khong the tai danh sach ban be admin", getErrorMeta(err));
      setError("Không thể tải danh sách quan hệ bạn bè.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
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
          <h1 className="text-3xl font-bold text-foreground">Quan hệ bạn bè</h1>
          <p className="mt-2 text-muted-foreground">
            Xem danh sách các quan hệ bạn bè đã chấp nhận.
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
        <h1 className="text-3xl font-bold text-foreground">Quan hệ bạn bè</h1>
        <p className="mt-2 text-muted-foreground">
          Tổng cộng {pagination.total} quan hệ bạn bè đã chấp nhận.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            value={sortBy}
            onChange={(event) => handleSortChange(event.target.value)}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="createdAt-desc">Mới nhất</option>
            <option value="createdAt-asc">Cũ nhất</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        ) : friendships.length === 0 ? (
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">Không có quan hệ bạn bè nào phù hợp.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Thử thay đổi từ khóa tìm kiếm hoặc kiểm tra lại dữ liệu.
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
                      Người dùng A
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Người dùng B
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
                  {friendships.map((friendship) => (
                    <tr
                      key={friendship._id}
                      className="border-b border-border/50 transition-colors hover:bg-muted/30"
                    >
                      <td className="px-6 py-4">
                        <UserCell user={friendship.userA} fallback="Người dùng A đã bị xóa" />
                      </td>
                      <td className="px-6 py-4">
                        <UserCell user={friendship.userB} fallback="Người dùng B đã bị xóa" />
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusConfig.accepted.className}`}
                        >
                          {statusConfig.accepted.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatDate(friendship.createdAt)}
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

export default AdminFriends;
