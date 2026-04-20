import { useEffect, useState } from "react";
import { Eye, Search, MessageSquare, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router";

import AdminPagination from "@/components/admin/AdminPagination";
import UserAvatar from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAdminSocketStore } from "@/stores/useAdminSocketStore";

interface SupportUser {
  _id: string;
  displayName: string;
  userName: string;
  email?: string;
  avatarUrl?: string;
}

interface SupportConversation {
  _id: string;
  supportStatus: "open" | "in_progress" | "resolved" | "closed";
  supportCreatedByUserId: string;
  assignedAdminId?: string | null;
  lastMessage?: {
    content?: string;
    senderDisplayName?: string;
  };
  updatedAt: string;
  unreadCounts?: Record<string, number>;
  supportCreatedByUser?: SupportUser;
  assignedAdmin?: {
    _id: string;
    displayName: string;
  };
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  open: {
    label: "Mở",
    className: "bg-blue-500/10 text-blue-700",
  },
  in_progress: {
    label: "Đang xử lý",
    className: "bg-yellow-500/10 text-yellow-700",
  },
  resolved: {
    label: "Đã giải quyết",
    className: "bg-emerald-500/10 text-emerald-700",
  },
  closed: {
    label: "Đóng",
    className: "bg-gray-500/10 text-gray-700",
  },
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "Không có";

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
    (state) => state.supportConversations as SupportConversation[],
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

  useEffect(() => {
    void fetchSupportConversations();
  }, [page, statusFilter, searchQuery, sortBy]);

  const fetchSupportConversations = async () => {
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
      setError("Không thể tải danh sách hỗ trợ.");
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

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Hỗ trợ khách hàng</h1>
          <p className="mt-2 text-muted-foreground">
            Quản lý và xử lý yêu cầu hỗ trợ từ người dùng.
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
        <h1 className="text-3xl font-bold text-foreground">Hỗ trợ khách hàng</h1>
        <p className="mt-2 text-muted-foreground">
          Tổng cộng {pagination.total} yêu cầu hỗ trợ cần xử lý.
        </p>
      </div>

      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-blue-700" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Hướng dẫn xử lý</p>
            <p className="text-sm text-muted-foreground">
              Nhấn vào yêu cầu để xem chi tiết và trả lời người dùng. Cập nhật
              trạng thái khi hoàn thành.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên hoặc username người dùng..."
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
            <option value="open">Mở</option>
            <option value="in_progress">Đang xử lý</option>
            <option value="resolved">Đã giải quyết</option>
            <option value="closed">Đóng</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => handleSortChange(event.target.value)}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="updatedAt-desc">Mới nhất</option>
            <option value="createdAt-desc">Tạo mới nhất</option>
            <option value="status">Theo trạng thái</option>
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
              <p className="mt-4 text-muted-foreground">Không có yêu cầu hỗ trợ nào.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tất cả các yêu cầu đã được xử lý.
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
                      Người dùng
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Trạng thái
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Nội dung
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Admin xử lý
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Cập nhật
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">
                      Hành động
                    </th>
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
                            name={conversation.supportCreatedByUser?.displayName ?? "Người dùng"}
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
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                            statusConfig[conversation.supportStatus].className
                          }`}
                        >
                          {statusConfig[conversation.supportStatus].label}
                        </span>
                      </td>
                      <td className="max-w-[250px] px-6 py-4 text-sm text-muted-foreground">
                        <span className="line-clamp-2">
                          {conversation.lastMessage?.content ?? "Không có nội dung"}
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
