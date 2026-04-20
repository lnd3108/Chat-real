import { useEffect, useState } from "react";
import {
  Ban,
  Eye,
  Info,
  Search,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import AdminPagination from "@/components/admin/AdminPagination";
import UserAvatar from "@/components/chat/UserAvatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { axiosInstance } from "@/lib/axios";

type BlockStatus = "active" | "inactive";
type BlockSort = "createdAt-desc" | "createdAt-asc" | "status";

interface UserSummary {
  _id: string;
  displayName: string;
  userName: string;
  email: string | null;
  avatarUrl?: string | null;
}

interface BlockRelation {
  _id: string;
  blocker: UserSummary | null;
  blockedUser: UserSummary | null;
  isActive: boolean;
  createdAt: string;
  unblockedAt: string | null;
  type: "direct-only" | string;
  reason?: string | null;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const statusConfig: Record<BlockStatus, { label: string; className: string }> = {
  active: {
    label: "Đang chặn",
    className: "bg-rose-500/10 text-rose-700",
  },
  inactive: {
    label: "Đã gỡ chặn",
    className: "bg-emerald-500/10 text-emerald-700",
  },
};

const formatDate = (value?: string | null) => {
  if (!value) return "Chưa gỡ";

  return new Date(value).toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "Chưa gỡ";

  return new Date(value).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

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

const AdminBlocks = () => {
  const [blocks, setBlocks] = useState<BlockRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | BlockStatus>("");
  const [sortBy, setSortBy] = useState<BlockSort>("createdAt-desc");
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });
  const [auditNote, setAuditNote] = useState(
    "Block relation chỉ áp dụng cho direct 1-1. Group chat không bị ảnh hưởng.",
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<BlockRelation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    void fetchBlocks();
  }, [page, searchQuery, statusFilter, sortBy]);

  useEffect(() => {
    if (!detailOpen || !selectedBlockId) {
      return;
    }

    void fetchBlockDetail(selectedBlockId);
  }, [detailOpen, selectedBlockId]);

  const fetchBlocks = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axiosInstance.get("/admin/blocks", {
        params: {
          page,
          limit: 20,
          q: searchQuery,
          status: statusFilter,
          sort: sortBy,
        },
      });

      setBlocks(response.data.data.blocks ?? []);
      setPagination(response.data.data.pagination);
      setAuditNote(response.data.data.auditNote ?? auditNote);
    } catch (err) {
      console.error(err);
      setError("Không thể tải danh sách quan hệ chặn.");
    } finally {
      setLoading(false);
    }
  };

  const fetchBlockDetail = async (blockId: string) => {
    try {
      setDetailLoading(true);

      const response = await axiosInstance.get(`/admin/blocks/${blockId}`);
      setSelectedBlock(response.data.data.block);
      setAuditNote(response.data.data.auditNote ?? auditNote);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải chi tiết quan hệ chặn.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (blockId: string) => {
    setSelectedBlockId(blockId);
    setSelectedBlock(null);
    setDetailOpen(true);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleStatusChange = (value: "" | BlockStatus) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleSortChange = (value: BlockSort) => {
    setSortBy(value);
    setPage(1);
  };

  const handleAdminUnblock = async (blockId: string) => {
    try {
      setUnblockingId(blockId);

      const response = await axiosInstance.patch(`/admin/blocks/${blockId}/unblock`);
      const updatedBlock: BlockRelation = response.data.data.block;

      setBlocks((currentBlocks) =>
        currentBlocks.map((block) => (block._id === blockId ? updatedBlock : block)),
      );
      setSelectedBlock((currentBlock) =>
        currentBlock?._id === blockId ? updatedBlock : currentBlock,
      );

      await fetchBlocks();
      toast.success("Đã gỡ chặn thủ công.");
    } catch (err) {
      console.error(err);
      toast.error("Không thể gỡ quan hệ chặn.");
    } finally {
      setUnblockingId(null);
    }
  };

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quản lý khối chặn</h1>
          <p className="mt-2 text-muted-foreground">
            Theo dõi và kiểm tra các quan hệ chặn direct 1-1.
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quản lý khối chặn</h1>
          <p className="mt-2 text-muted-foreground">
            Tổng cộng {pagination.total} quan hệ chặn để kiểm tra và audit.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Phạm vi block</p>
              <p className="text-sm text-muted-foreground">{auditNote}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-sky-700" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Ghi chú kiểm tra</p>
              <p className="text-sm text-muted-foreground">
                Dữ liệu hiển thị theo từng quan hệ, gồm trạng thái hiện tại,
                thời điểm tạo và thời điểm gỡ chặn nếu có.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm người chặn hoặc người bị chặn..."
              value={searchQuery}
              onChange={(event) => handleSearch(event.target.value)}
              className="border-border/50 bg-muted/50 pl-10 focus:border-primary/50"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => handleStatusChange(event.target.value as "" | BlockStatus)}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang chặn</option>
            <option value="inactive">Đã gỡ chặn</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => handleSortChange(event.target.value as BlockSort)}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="createdAt-desc">Mới nhất</option>
            <option value="createdAt-asc">Cũ nhất</option>
            <option value="status">Ưu tiên active</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        ) : blocks.length === 0 ? (
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">Không tìm thấy quan hệ chặn nào.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Kiểm tra lại bộ lọc hoặc từ khóa tìm kiếm.
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
                      Người chặn
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Người bị chặn
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Trạng thái
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Tạo lúc
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Gỡ lúc
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Loại
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((block) => {
                    const status = block.isActive ? "active" : "inactive";

                    return (
                      <tr
                        key={block._id}
                        className="border-b border-border/50 transition-colors hover:bg-muted/30"
                      >
                        <td className="px-6 py-4">
                          <UserCell user={block.blocker} fallback="Người chặn đã bị xóa" />
                        </td>
                        <td className="px-6 py-4">
                          <UserCell
                            user={block.blockedUser}
                            fallback="Người bị chặn đã bị xóa"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusConfig[status].className}`}
                          >
                            {statusConfig[status].label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {formatShortDate(block.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {formatShortDate(block.unblockedAt)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-700">
                            {block.type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="ml-auto flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-10 rounded-xl border border-border/50 bg-background/40 px-3 text-muted-foreground hover:bg-background/70 hover:text-foreground"
                              onClick={() => handleOpenDetail(block._id)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Chi tiết
                            </Button>

                            {block.isActive && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 rounded-xl border-destructive/30 bg-destructive/5 px-3 text-destructive hover:bg-destructive/10"
                                    disabled={unblockingId === block._id}
                                  >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Gỡ chặn
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent size="sm">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Gỡ quan hệ chặn?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Thao tác này sẽ bỏ chặn direct 1-1 giữa hai
                                      người dùng. Group chat chung vẫn không bị ảnh hưởng.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel disabled={unblockingId === block._id}>
                                      Hủy
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      disabled={unblockingId === block._id}
                                      onClick={() => void handleAdminUnblock(block._id)}
                                    >
                                      {unblockingId === block._id
                                        ? "Đang xử lý..."
                                        : "Xác nhận gỡ"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedBlockId(null);
            setSelectedBlock(null);
          }
        }}
      >
        <DialogContent className="border-border/40 bg-card/95 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết quan hệ chặn</DialogTitle>
            <DialogDescription>{auditNote}</DialogDescription>
          </DialogHeader>

          {detailLoading || !selectedBlock ? (
            <div className="flex h-56 items-center justify-center">
              <LoadingSpinner className="h-7 w-7" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                  <p className="text-sm font-medium text-foreground">Người chặn</p>
                  <div className="mt-3">
                    <UserCell
                      user={selectedBlock.blocker}
                      fallback="Người chặn đã bị xóa"
                    />
                  </div>
                  {selectedBlock.blocker?.email && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {selectedBlock.blocker.email}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                  <p className="text-sm font-medium text-foreground">Người bị chặn</p>
                  <div className="mt-3">
                    <UserCell
                      user={selectedBlock.blockedUser}
                      fallback="Người bị chặn đã bị xóa"
                    />
                  </div>
                  {selectedBlock.blockedUser?.email && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {selectedBlock.blockedUser.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border/50 bg-card/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Mã quan hệ
                  </p>
                  <p className="mt-2 break-all font-mono text-sm text-foreground">
                    {selectedBlock._id}
                  </p>
                </div>

                <div className="rounded-xl border border-border/50 bg-card/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Loại
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {selectedBlock.type}
                  </p>
                </div>

                <div className="rounded-xl border border-border/50 bg-card/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Trạng thái
                  </p>
                  <div className="mt-2">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        statusConfig[selectedBlock.isActive ? "active" : "inactive"].className
                      }`}
                    >
                      {statusConfig[selectedBlock.isActive ? "active" : "inactive"].label}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-border/50 bg-card/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Tạo lúc
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {formatDate(selectedBlock.createdAt)}
                  </p>
                </div>

                <div className="rounded-xl border border-border/50 bg-card/70 p-4 md:col-span-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Gỡ lúc
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {formatDate(selectedBlock.unblockedAt)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">Lý do chặn</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedBlock.reason?.trim() || "Không có lý do được lưu."}
                </p>
              </div>

              {selectedBlock.isActive && (
                <div className="flex justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
                        disabled={unblockingId === selectedBlock._id}
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Gỡ chặn thủ công
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent size="sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận gỡ chặn?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Thao tác này chỉ mở lại direct 1-1 giữa hai người dùng.
                          Group chat chung vẫn hoạt động bình thường.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={unblockingId === selectedBlock._id}>
                          Hủy
                        </AlertDialogCancel>
                        <AlertDialogAction
                          disabled={unblockingId === selectedBlock._id}
                          onClick={() => void handleAdminUnblock(selectedBlock._id)}
                        >
                          {unblockingId === selectedBlock._id
                            ? "Đang xử lý..."
                            : "Gỡ chặn"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBlocks;
