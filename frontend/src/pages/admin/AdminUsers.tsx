import { Plus, Eye, Edit, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { axiosInstance } from "@/lib/axios";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import UserAvatar from "@/components/chat/UserAvatar";

interface User {
  _id: string;
  displayName: string;
  userName: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "inactive" | "suspended";
  avatarUrl?: string;
  createdAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });

  useEffect(() => {
    fetchUsers();
  }, [page, searchQuery, statusFilter, sortBy]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosInstance.get("/admin/users", {
        params: {
          page,
          limit: 20,
          q: searchQuery,
          status: statusFilter,
          sort: sortBy,
        },
      });
      setUsers(response.data.data.users);
      setPagination(response.data.data.pagination);
    } catch (err: any) {
      setError("Không thể tải danh sách người dùng");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: {
        bg: "bg-green-500/10",
        text: "text-green-700",
        label: "Hoạt động",
      },
      inactive: {
        bg: "bg-gray-500/10",
        text: "text-gray-700",
        label: "Không hoạt động",
      },
      suspended: {
        bg: "bg-red-500/10",
        text: "text-red-700",
        label: "Bị tạm khóa",
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;

    return (
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quản lý người dùng</h1>
          <p className="mt-2 text-muted-foreground">Quản lý tất cả người dùng trên hệ thống</p>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quản lý người dùng</h1>
          <p className="mt-2 text-muted-foreground">
            Tổng cộng {pagination.total} người dùng
          </p>
        </div>
        <Button className="gap-2 bg-gradient-chat text-white">
          <Plus className="h-4 w-4" />
          Thêm người dùng
        </Button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên, email..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="bg-muted/50 border-border/50 pl-10 focus:border-primary/50"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border/50 bg-muted/50 text-sm focus:border-primary/50 focus:outline-none transition-colors"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Hoạt động</option>
              <option value="inactive">Không hoạt động</option>
              <option value="suspended">Bị tạm khóa</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border/50 bg-muted/50 text-sm focus:border-primary/50 focus:outline-none transition-colors"
            >
              <option value="createdAt">Mới nhất</option>
              <option value="username">Username (A→Z)</option>
              <option value="displayName">Tên hiển thị (A→Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <p className="text-muted-foreground">Không tìm thấy người dùng nào</p>
              <p className="text-sm text-muted-foreground mt-1">
                Thử thay đổi bộ lọc hoặc tìm kiếm
              </p>
            </div>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Người dùng
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Trạng thái
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Ngày tạo
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user._id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          type="chat"
                          name={user.displayName}
                          avatarUrl={user.avatarUrl}
                          className="size-10"
                        />
                        <div>
                          <p className="font-medium text-foreground">{user.displayName}</p>
                          <p className="text-sm text-muted-foreground">@{user.userName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{user.email}</td>
                    <td className="px-6 py-4">{getStatusBadge(user.status)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                          user.role === "admin"
                            ? "bg-purple-500/10 text-purple-700"
                            : "bg-blue-500/10 text-blue-700"
                        }`}
                      >
                        {user.role === "admin" ? "Admin" : "User"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 hover:bg-muted/50 rounded-lg transition-colors">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button className="p-2 hover:bg-muted/50 rounded-lg transition-colors">
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button className="p-2 hover:bg-destructive/10 rounded-lg transition-colors">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between border-t border-border/50 px-6 py-4">
                <div className="text-sm text-muted-foreground">
                  Trang {pagination.page} / {pagination.pages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === pagination.pages}
                    onClick={() => setPage(page + 1)}
                    className="gap-2"
                  >
                    Sau
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
