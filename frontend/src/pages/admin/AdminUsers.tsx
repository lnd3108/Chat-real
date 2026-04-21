import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Eye, Search } from "lucide-react";

import AdminPagination from "@/components/admin/AdminPagination";
import AdminUserStatusDialog from "@/components/admin/AdminUserStatusDialog";
import UserAvatar from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { getErrorMessage } from "@/lib/httpError";
import { useAdminSocketStore } from "@/stores/useAdminSocketStore";
import type { AdminUserRecord, AdminUserStatus, PaginationData } from "@/types/admin";

const statusConfig: Record<AdminUserStatus, { label: string; className: string }> = {
  active: { label: "Hoat dong", className: "bg-emerald-500/10 text-emerald-700" },
  banned: { label: "Bi khoa", className: "bg-rose-500/10 text-rose-700" },
  inactive: { label: "Khong hoat dong", className: "bg-slate-500/10 text-slate-700" },
  suspended: { label: "Tam khoa", className: "bg-amber-500/10 text-amber-700" },
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

const AdminUsers = () => {
  const navigate = useNavigate();
  const users = useAdminSocketStore((state) => state.users as AdminUserRecord[]);
  const loading = useAdminSocketStore((state) => state.usersLoading);
  const pagination = useAdminSocketStore(
    (state) => state.usersPagination as PaginationData,
  );
  const fetchUsersFromStore = useAdminSocketStore((state) => state.fetchUsers);
  const upsertUser = useAdminSocketStore((state) => state.upsertUser);

  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");

  const fetchUsers = useCallback(async () => {
    try {
      await fetchUsersFromStore({
        page,
        limit: 20,
        q: searchQuery,
        status: statusFilter,
        sort: sortBy,
      });
      setError(null);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, "Khong the tai danh sach nguoi dung."));
    }
  }, [fetchUsersFromStore, page, searchQuery, sortBy, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchUsers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchUsers]);

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

  const updateUserStatusLocally = (userId: string, status: "active" | "banned") => {
    upsertUser({ _id: userId, status });
  };

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quan ly nguoi dung</h1>
          <p className="mt-2 text-muted-foreground">
            Xem danh sach user va cap nhat trang thai tai khoan.
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quan ly nguoi dung</h1>
          <p className="mt-2 text-muted-foreground">Tong cong {pagination.total} nguoi dung</p>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tim theo ten, email..."
              value={searchQuery}
              onChange={(event) => handleSearch(event.target.value)}
              className="border-border/50 bg-muted/50 pl-10 focus:border-primary/50"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => handleStatusChange(event.target.value)}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="">Tat ca trang thai</option>
            <option value="active">Hoat dong</option>
            <option value="banned">Bi khoa</option>
            <option value="inactive">Khong hoat dong</option>
            <option value="suspended">Tam khoa</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => handleSortChange(event.target.value)}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="createdAt">Moi nhat</option>
            <option value="username">Username (A-Z)</option>
            <option value="displayName">Ten hien thi (A-Z)</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">Khong tim thay nguoi dung nao</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Thu thay doi bo loc hoac tu khoa tim kiem.
              </p>
            </div>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Nguoi dung</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Trang thai</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Vai tro</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Ngay tao</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Hanh dong</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user._id}
                    className="border-b border-border/50 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          type="chat"
                          name={user.displayName}
                          avatarUrl={user.avatarUrl ?? undefined}
                          className="size-10"
                        />
                        <div>
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/users/${user._id}`)}
                            className="text-left"
                          >
                            <p className="font-medium text-foreground hover:underline">
                              {user.displayName}
                            </p>
                            <p className="text-sm text-muted-foreground">@{user.userName}</p>
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{user.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                          statusConfig[user.status]?.className ?? statusConfig.active.className
                        }`}
                      >
                        {statusConfig[user.status]?.label ?? user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                          user.role === "admin"
                            ? "bg-amber-500/10 text-amber-700"
                            : "bg-sky-500/10 text-sky-700"
                        }`}
                      >
                        {user.role === "admin" ? "Admin" : "Nguoi dung"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="ml-auto flex w-[172px] flex-col items-stretch gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-10 justify-start rounded-xl border border-border/50 bg-background/40 px-3 text-muted-foreground hover:bg-background/70 hover:text-foreground"
                          onClick={() => navigate(`/admin/users/${user._id}`)}
                          aria-label={`Xem chi tiet ${user.displayName}`}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Xem chi tiet
                        </Button>
                        <AdminUserStatusDialog
                          userId={user._id}
                          userName={user.userName}
                          displayName={user.displayName}
                          currentStatus={user.status}
                          fullWidth
                          buttonClassName="h-10 rounded-xl border-border/50 bg-background/40 px-3"
                          onSuccess={(status) => updateUserStatusLocally(user._id, status)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

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

export default AdminUsers;
