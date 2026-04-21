import { useEffect, useState } from "react";
import { getErrorMeta, logger } from "@/lib/logger";
import { Eye, MessagesSquare, Search, ShieldAlert, Users } from "lucide-react";

import AdminPagination from "@/components/admin/AdminPagination";
import UserAvatar from "@/components/chat/UserAvatar";
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

type ConversationType = "direct" | "group" | "support";

interface LastMessage {
  _id: string | null;
  content: string | null;
  imgUrl: string | null;
  senderId: string | null;
  senderDisplayName: string | null;
  senderAvatar: string | null;
  createdAt: string | null;
}

interface ConversationRow {
  _id: string;
  type: ConversationType;
  groupName: string | null;
  membersCount: number;
  messagesCount: number;
  lastMessage: LastMessage | null;
  updatedAt: string;
  createdAt: string;
}

interface ConversationMember {
  _id: string | null;
  displayName: string | null;
  userName: string | null;
  email: string | null;
  avatarUrl: string | null;
  joinedAt: string | null;
}

interface ConversationDetail {
  _id: string;
  type: ConversationType;
  groupName: string | null;
  creator: ConversationMember | null;
  members: ConversationMember[];
  membersCount: number;
  messagesCount: number;
  lastMessage: LastMessage | null;
  updatedAt: string;
  createdAt: string;
  directBlockStatus: {
    blockedByUserA: boolean;
    blockedByUserB: boolean;
    hasDirectBlock: boolean;
    note: string;
  } | null;
  note: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const typeConfig: Record<ConversationType, { label: string; className: string }> = {
  direct: {
    label: "Trực tiếp",
    className: "bg-sky-500/10 text-sky-700",
  },
  group: {
    label: "Nhóm",
    className: "bg-amber-500/10 text-amber-700",
  },
  support: {
    label: "Hỗ trợ",
    className: "bg-emerald-500/10 text-emerald-700",
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

const formatShortDate = (dateString?: string | null) => {
  if (!dateString) return "Không có";

  return new Date(dateString).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const getLastMessagePreview = (lastMessage: LastMessage | null) => {
  if (!lastMessage) return "Chưa có tin nhắn";
  if (lastMessage.content?.trim()) return lastMessage.content;
  if (lastMessage.imgUrl) return "Đã gửi một hình ảnh";
  return "Tin nhắn không có nội dung";
};

const MemberCell = ({
  member,
  fallback,
}: {
  member: ConversationMember | null;
  fallback: string;
}) => {
  if (!member?._id) {
    return <span className="text-sm text-muted-foreground">{fallback}</span>;
  }

  return (
    <div className="flex items-center gap-3">
      <UserAvatar
        type="chat"
        name={member.displayName ?? member.userName ?? "Người dùng"}
        avatarUrl={member.avatarUrl ?? undefined}
        className="size-10"
      />
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">
          {member.displayName ?? "Không có tên"}
        </p>
        <p className="truncate text-sm text-muted-foreground">@{member.userName ?? "unknown"}</p>
      </div>
    </div>
  );
};

const AdminConversations = () => {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<"" | "direct" | "group">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("updatedAt-desc");
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    void fetchConversations();
  }, [page, typeFilter, searchQuery, sortBy]);

  useEffect(() => {
    if (!detailOpen || !selectedConversationId) {
      return;
    }

    void fetchConversationDetail(selectedConversationId);
  }, [detailOpen, selectedConversationId]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axiosInstance.get("/admin/conversations", {
        params: {
          page,
          limit: 20,
          type: typeFilter,
          q: searchQuery,
          sort: sortBy,
        },
      });

      setConversations(response.data.data.conversations ?? []);
      setPagination(response.data.data.pagination);
    } catch (err) {
      logger.error("Khong the tai du lieu cuoc tro chuyen admin", getErrorMeta(err));
      setError("Không thể tải danh sách cuộc trò chuyện.");
    } finally {
      setLoading(false);
    }
  };

  const fetchConversationDetail = async (conversationId: string) => {
    try {
      setDetailLoading(true);
      const response = await axiosInstance.get(`/admin/conversations/${conversationId}`);
      setSelectedConversation(response.data.data.conversation);
    } catch (err) {
      logger.error("Khong the tai du lieu cuoc tro chuyen admin", getErrorMeta(err));
      setSelectedConversation(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleTypeChange = (value: "" | "direct" | "group") => {
    setTypeFilter(value);
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    setPage(1);
  };

  const handleOpenDetail = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setSelectedConversation(null);
    setDetailOpen(true);
  };

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quản lý cuộc trò chuyện</h1>
          <p className="mt-2 text-muted-foreground">
            Tra cứu hội thoại trực tiếp và nhóm.
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
        <h1 className="text-3xl font-bold text-foreground">Quản lý cuộc trò chuyện</h1>
        <p className="mt-2 text-muted-foreground">
          Tổng cộng {pagination.total} cuộc trò chuyện để tra cứu và audit.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Lưu ý về block trong group</p>
            <p className="text-sm text-muted-foreground">
              Nếu 2 user block nhau nhưng vẫn cùng group, admin vẫn xem group hoạt động
              bình thường. Block direct không phải lỗi của group chat.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm groupName hoặc username thành viên..."
              value={searchQuery}
              onChange={(event) => handleSearch(event.target.value)}
              className="border-border/50 bg-muted/50 pl-10 focus:border-primary/50"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(event) => handleTypeChange(event.target.value as "" | "direct" | "group")}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="">Tất cả loại</option>
            <option value="direct">Trực tiếp</option>
            <option value="group">Nhóm</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => handleSortChange(event.target.value)}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="updatedAt-desc">Cập nhật gần nhất</option>
            <option value="updatedAt-asc">Cập nhật cũ nhất</option>
            <option value="createdAt-desc">Tạo mới nhất</option>
            <option value="createdAt-asc">Tạo cũ nhất</option>
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
              <p className="text-muted-foreground">Không tìm thấy cuộc trò chuyện nào phù hợp.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.
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
                      Cuộc trò chuyện
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Thành viên
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Tin nhắn
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Tin nhắn cuối
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Cập nhật lúc
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
                        <div className="space-y-2">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                              (typeConfig[conversation.type] ?? typeConfig.support).className
                            }`}
                          >
                            {(typeConfig[conversation.type] ?? typeConfig.support).label}
                          </span>
                          <p className="font-medium text-foreground">
                            {conversation.type === "group"
                              ? conversation.groupName ?? "Nhóm"
                              : "Cuộc trò chuyện trực tiếp"}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {conversation._id}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {conversation.membersCount}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {conversation.messagesCount}
                      </td>
                      <td className="max-w-[320px] px-6 py-4 text-sm text-muted-foreground">
                        <span className="line-clamp-2">
                          {getLastMessagePreview(conversation.lastMessage)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatShortDate(conversation.updatedAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-10 rounded-xl border border-border/50 bg-background/40 px-3 text-muted-foreground hover:bg-background/70 hover:text-foreground"
                          onClick={() => handleOpenDetail(conversation._id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Chi tiết
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

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedConversationId(null);
            setSelectedConversation(null);
          }
        }}
      >
        <DialogContent className="border-border/40 bg-card/95 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Chi tiết cuộc trò chuyện</DialogTitle>
            <DialogDescription>
              Dùng để kiểm tra direct và group hoạt động thế nào trong hệ thống.
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !selectedConversation ? (
            <div className="flex h-64 items-center justify-center">
              <LoadingSpinner className="h-8 w-8" />
            </div>
          ) : (
            <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                    (typeConfig[selectedConversation.type] ?? typeConfig.support).className
                  }`}
                >
                  {(typeConfig[selectedConversation.type] ?? typeConfig.support).label}
                </span>
                {selectedConversation.type === "group" && (
                  <span className="text-sm font-medium text-foreground">
                    {selectedConversation.groupName ?? "Nhóm"}
                  </span>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border/50 bg-card/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Mã cuộc trò chuyện
                  </p>
                  <p className="mt-2 break-all font-mono text-sm text-foreground">
                    {selectedConversation._id}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-card/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Số tin nhắn
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {selectedConversation.messagesCount}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-card/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Số thành viên
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {selectedConversation.membersCount}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-card/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Cập nhật lúc
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {formatDate(selectedConversation.updatedAt)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">Tin nhắn cuối</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {getLastMessagePreview(selectedConversation.lastMessage)}
                </p>
                {selectedConversation.lastMessage?.senderDisplayName && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Gửi bởi {selectedConversation.lastMessage.senderDisplayName}
                  </p>
                )}
              </div>

              {selectedConversation.type === "direct" ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    {selectedConversation.members.map((member, index) => (
                      <div
                        key={member._id ?? `member-${index}`}
                        className="rounded-xl border border-border/50 bg-muted/20 p-4"
                      >
                        <p className="text-sm font-medium text-foreground">Thành viên {index + 1}</p>
                        <div className="mt-3">
                          <MemberCell member={member} fallback="Người dùng đã bị xóa" />
                        </div>
                        {member.email && (
                          <p className="mt-3 text-sm text-muted-foreground">{member.email}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700" />
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">Trạng thái block direct</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedConversation.directBlockStatus?.note ??
                            "Không có dữ liệu block status."}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                              selectedConversation.directBlockStatus?.hasDirectBlock
                                ? "bg-rose-500/10 text-rose-700"
                                : "bg-emerald-500/10 text-emerald-700"
                            }`}
                          >
                            {selectedConversation.directBlockStatus?.hasDirectBlock
                              ? "Có block direct"
                              : "Không có block direct"}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                            User 1 chặn User 2:{" "}
                            {selectedConversation.directBlockStatus?.blockedByUserA ? "Có" : "Không"}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                            User 2 chặn User 1:{" "}
                            {selectedConversation.directBlockStatus?.blockedByUserB ? "Có" : "Không"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <MessagesSquare className="mt-0.5 h-5 w-5 text-sky-700" />
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">Ghi chú nhóm</p>
                        <p className="text-sm text-muted-foreground">{selectedConversation.note}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                    <p className="text-sm font-medium text-foreground">Người tạo / Chủ sở hữu</p>
                    <div className="mt-3">
                      <MemberCell
                        member={selectedConversation.creator}
                        fallback="Người tạo đã bị xóa"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-card/70 p-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Thành viên</p>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {selectedConversation.members.map((member, index) => (
                        <div
                          key={member._id ?? `group-member-${index}`}
                          className="rounded-xl border border-border/50 bg-background/50 p-3"
                        >
                          <MemberCell member={member} fallback="Người dùng đã bị xóa" />
                          <p className="mt-2 text-xs text-muted-foreground">
                            Tham gia: {formatShortDate(member.joinedAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminConversations;
