import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Eye, Search } from "lucide-react";

import AdminDeleteUserDialog from "@/components/admin/AdminDeleteUserDialog";
import AdminPagination from "@/components/admin/AdminPagination";
import RoleBadge from "@/components/admin/RoleBadge";
import AdminUserStatusDialog from "@/components/admin/AdminUserStatusDialog";
import UpdateUserRoleModal from "@/components/admin/UpdateUserRoleModal";
import UserAvatar from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { getErrorMessage } from "@/lib/httpError";
import { APP_PERMISSIONS, canManageUser, hasPermission } from "@/lib/rbac";
import { useAdminSocketStore } from "@/stores/useAdminSocketStore";
import { useAuthStore } from "@/stores/useAuthStore";
import type { AdminUserRecord, AdminUserStatus, PaginationData } from "@/types/admin";

const statusConfig: Record<AdminUserStatus, { label: string; className: string }> = {
  active: { label: "Hoạt động", className: "bg-emerald-500/10 text-emerald-700" },
  banned: { label: "Bị khóa", className: "bg-rose-500/10 text-rose-700" },
  inactive: { label: "Không hoạt động", className: "bg-slate-500/10 text-slate-700" },
  suspended: { label: "Tạm khóa", className: "bg-amber-500/10 text-amber-700" },
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
  const pagination = useAdminSocketStore((state) => state.usersPagination as PaginationData);
  const fetchUsersFromStore = useAdminSocketStore((state) => state.fetchUsers);
  const upsertUser = useAdminSocketStore((state) => state.upsertUser);
  const removeUser = useAdminSocketStore((state) => state.removeUser);
  const currentUser = useAuthStore((state) => state.user);

  const canAssignRole = hasPermission(currentUser, APP_PERMISSIONS.ROLE_ASSIGN);
  const canDeleteUser = hasPermission(currentUser, APP_PERMISSIONS.USER_DELETE);
  const canToggleUserStatus =
    hasPermission(currentUser, APP_PERMISSIONS.USER_LOCK) ||
    hasPermission(currentUser, APP_PERMISSIONS.USER_UNLOCK);

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
      setError(getErrorMessage(err, "Không thể tải danh sách người dùng."));
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

  const visibleUsers = useMemo(
    () =>
      users.filter((user) => currentUser?._id !== user._id && canManageUser(currentUser, user)),
    [currentUser, users],
  );

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quản lý người dùng</h1>
          <p className="mt-2 text-muted-foreground">
            Chỉ hiển thị các tài khoản thuộc phạm vi quản lý của bạn.
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
          <h1 className="text-3xl font-bold text-foreground">Quản lý người dùng</h1>
          <p className="mt-2 text-muted-foreground">
            Tổng cộng {pagination.total} tài khoản thuộc phạm vi quản lý hiện tại.
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên, email..."
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
            <option value="">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="banned">Bị khóa</option>
            <option value="inactive">Không hoạt động</option>
            <option value="suspended">Tạm khóa</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => handleSortChange(event.target.value)}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="createdAt">Mới nhất</option>
            <option value="username">Username (A-Z)</option>
            <option value="displayName">Tên hiển thị (A-Z)</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">Không có tài khoản nào trong phạm vi quản lý.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.
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
                    Vai trò
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
                {visibleUsers.map((user) => {
                  const manageable = canManageUser(currentUser, user);

                  return (
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
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="ml-auto flex w-[188px] flex-col items-stretch gap-2">
                          {manageable ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-10 justify-start rounded-xl border border-border/50 bg-background/40 px-3 text-muted-foreground hover:bg-background/70 hover:text-foreground"
                              onClick={() => navigate(`/admin/users/${user._id}`)}
                              aria-label={`Xem chi tiết ${user.displayName}`}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Xem chi tiết
                            </Button>
                          ) : null}

                          {manageable && canToggleUserStatus ? (
                            <AdminUserStatusDialog
                              userId={user._id}
                              userName={user.userName}
                              displayName={user.displayName}
                              currentStatus={user.status}
                              fullWidth
                              buttonClassName="h-10 rounded-xl border-border/50 bg-background/40 px-3"
                              onSuccess={(status) => updateUserStatusLocally(user._id, status)}
                            />
                          ) : null}

                          {manageable && canAssignRole ? (
                            <UpdateUserRoleModal
                              user={user}
                              fullWidth
                              triggerClassName="h-10 rounded-xl border-border/50 bg-background/40 px-3"
                              onSuccess={(updatedUser) =>
                                upsertUser({
                                  ...updatedUser,
                                  _id: user._id,
                                })
                              }
                            />
                          ) : null}

                          {manageable && canDeleteUser ? (
                            <AdminDeleteUserDialog
                              userId={user._id}
                              userName={user.userName}
                              displayName={user.displayName}
                              fullWidth
                              redirectToUsers={false}
                              onSuccess={() => removeUser(user._id)}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <AdminPagination
              page={pagination.page}
              pages={pagination.pages}
              onPrevious={() => setPage((current) => current - 1)}
              onNext={() => setPage((current) => current + 1)}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
