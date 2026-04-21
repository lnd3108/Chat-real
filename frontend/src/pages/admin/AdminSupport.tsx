import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Eye, MessageSquare, Search } from "lucide-react";
import { useNavigate } from "react-router";

import AdminPagination from "@/components/admin/AdminPagination";
import UserAvatar from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { getErrorMessage } from "@/lib/httpError";
import { useAdminSocketStore } from "@/stores/useAdminSocketStore";
import type { AdminSupportConversationRecord, PaginationData } from "@/types/admin";

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Mo", className: "bg-blue-500/10 text-blue-700" },
  in_progress: { label: "Dang xu ly", className: "bg-yellow-500/10 text-yellow-700" },
  resolved: { label: "Da giai quyet", className: "bg-emerald-500/10 text-emerald-700" },
  closed: { label: "Dong", className: "bg-gray-500/10 text-gray-700" },
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) {
    return "Khong co";
  }

  return new Date(dateString).toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AdminSupport = () => {
  const navigate = useNavigate();
  const conversations = useAdminSocketStore(
    (state) => state.supportConversations as AdminSupportConversationRecord[],
  );
  const loading = useAdminSocketStore((state) => state.supportLoading);
  const pagination = useAdminSocketStore(
    (state) => state.supportPagination as PaginationData,
  );
  const fetchSupportConversationsFromStore = useAdminSocketStore(
    (state) => state.fetchSupportConversations,
  );
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("updatedAt-desc");

  const fetchSupportConversations = useCallback(async () => {
    try {
      await fetchSupportConversationsFromStore({
        page,
        limit: 20,
        status: statusFilter,
        q: searchQuery,
        sort: sortBy,
      });
      setError(null);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, "Khong the tai danh sach ho tro."));
    }
  }, [fetchSupportConversationsFromStore, page, searchQuery, sortBy, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchSupportConversations();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchSupportConversations]);

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ho tro khach hang</h1>
          <p className="mt-2 text-muted-foreground">
            Quan ly va xu ly yeu cau ho tro tu nguoi dung.
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
        <h1 className="text-3xl font-bold text-foreground">Ho tro khach hang</h1>
        <p className="mt-2 text-muted-foreground">
          Tong cong {pagination.total} yeu cau ho tro can xu ly.
        </p>
      </div>

      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-blue-700" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Huong dan xu ly</p>
            <p className="text-sm text-muted-foreground">
              Nhan vao yeu cau de xem chi tiet va tra loi nguoi dung. Cap nhat trang thai khi hoan thanh.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tim theo ten hoac username nguoi dung..."
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
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="">Tat ca trang thai</option>
            <option value="open">Mo</option>
            <option value="in_progress">Dang xu ly</option>
            <option value="resolved">Da giai quyet</option>
            <option value="closed">Dong</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="updatedAt-desc">Moi nhat</option>
            <option value="createdAt-desc">Tao moi nhat</option>
            <option value="status">Theo trang thai</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">Khong co yeu cau ho tro nao.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tat ca cac yeu cau da duoc xu ly.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Nguoi dung</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Trang thai</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Noi dung</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Admin xu ly</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Cap nhat</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Hanh dong</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.map((conversation) => (
                    <tr
                      key={conversation._id}
                      className="border-b border-border/50 transition-colors hover:bg-muted/30"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            type="chat"
                            name={conversation.supportCreatedByUser?.displayName ?? "Nguoi dung"}
                            avatarUrl={conversation.supportCreatedByUser?.avatarUrl}
                            className="size-9"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {conversation.supportCreatedByUser?.displayName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              @{conversation.supportCreatedByUser?.userName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusConfig[conversation.supportStatus].className}`}>
                          {statusConfig[conversation.supportStatus].label}
                        </span>
                      </td>
                      <td className="max-w-[250px] px-6 py-4 text-sm text-muted-foreground">
                        <span className="line-clamp-2">
                          {conversation.lastMessage?.content ?? "Khong co noi dung"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {conversation.assignedAdmin?.displayName ?? "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatDate(conversation.updatedAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-10 rounded-xl border border-border/50 bg-background/40 px-3 text-muted-foreground hover:bg-background/70 hover:text-foreground"
                          onClick={() => navigate(`/admin/support/${conversation._id}`)}
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

export default AdminSupport;
