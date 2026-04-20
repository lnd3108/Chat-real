import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Clock, Send } from "lucide-react";

import UserAvatar from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { axiosInstance } from "@/lib/axios";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAdminSocketStore } from "@/stores/useAdminSocketStore";

interface SupportMessage {
  _id: string;
  senderId: string;
  content: string;
  createdAt: string;
  senderDisplayName?: string;
  type?: string;
}

interface SupportConversation {
  _id: string;
  supportStatus: "open" | "in_progress" | "resolved" | "closed";
  supportCreatedByUserId: string;
  supportCreatedByUser?: {
    _id: string;
    displayName: string;
    email?: string;
    avatarUrl?: string;
  };
  assignedAdminId?: string | null;
  assignedAdmin?: {
    _id: string;
    displayName: string;
  };
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  lastMessage?: {
    content?: string;
  };
}

const statusConfig: Record<
  SupportConversation["supportStatus"],
  { label: string; className: string; icon: typeof AlertCircle }
> = {
  open: {
    label: "Mở",
    className: "bg-blue-500/10 text-blue-700",
    icon: AlertCircle,
  },
  in_progress: {
    label: "Đang xử lý",
    className: "bg-yellow-500/10 text-yellow-700",
    icon: Clock,
  },
  resolved: {
    label: "Đã giải quyết",
    className: "bg-emerald-500/10 text-emerald-700",
    icon: CheckCircle2,
  },
  closed: {
    label: "Đóng",
    className: "bg-gray-500/10 text-gray-700",
    icon: CheckCircle2,
  },
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "Không có";

  return new Date(dateString).toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AdminSupportDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.user?._id);
  const fetchSupportConversationDetail = useAdminSocketStore(
    (state) => state.fetchSupportConversationDetail,
  );
  const supportMessagesByConversation = useAdminSocketStore(
    (state) => state.supportMessagesByConversation,
  );
  const supportConversations = useAdminSocketStore(
    (state) => state.supportConversations,
  );
  const setActiveSupportConversationId = useAdminSocketStore(
    (state) => state.setActiveSupportConversationId,
  );

  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [newStatus, setNewStatus] = useState<SupportConversation["supportStatus"] | "">("");

  useEffect(() => {
    void fetchConversationDetail();
  }, [id]);

  useEffect(() => {
    setActiveSupportConversationId(id ?? null);
    return () => {
      setActiveSupportConversationId(null);
    };
  }, [id, setActiveSupportConversationId]);

  useEffect(() => {
    if (!id) {
      return;
    }
    setMessages((supportMessagesByConversation[id] as SupportMessage[]) ?? []);
    const nextConversation = supportConversations.find((item) => item._id === id);
    if (nextConversation) {
      setConversation(nextConversation as SupportConversation);
      setNewStatus(nextConversation.supportStatus);
    }
  }, [id, supportConversations, supportMessagesByConversation]);

  const fetchConversationDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetchSupportConversationDetail(id!);

      setConversation((response.conversation as SupportConversation | null) ?? null);
      setMessages((response.messages as SupportMessage[]) ?? []);
      setNewStatus(response.conversation?.supportStatus ?? "");
    } catch (err) {
      console.error(err);
      setError("Không thể tải chi tiết hỗ trợ.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyContent.trim() || !id) return;

    try {
      setSending(true);

      const response = await axiosInstance.post("/admin/support/messages", {
        conversationId: id,
        content: replyContent.trim(),
      });

      if (response.data.data.conversation) {
        setConversation(response.data.data.conversation);
        setNewStatus(response.data.data.conversation.supportStatus);
      }

      setReplyContent("");
    } catch (err) {
      console.error(err);
      alert("Không thể gửi phản hồi.");
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: SupportConversation["supportStatus"]) => {
    if (!id) return;

    try {
      const response = await axiosInstance.patch(`/admin/support/conversations/${id}/status`, {
        status,
      });

      setNewStatus(status);
      if (response.data.data.conversation) {
        setConversation(response.data.data.conversation);
      } else if (conversation) {
        setConversation({ ...conversation, supportStatus: status });
      }
    } catch (err) {
      console.error(err);
      alert("Không thể cập nhật trạng thái.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="space-y-6">
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/admin/support")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
          {error ?? "Không thể tải chi tiết hỗ trợ."}
        </div>
      </div>
    );
  }

  const StatusIcon = statusConfig[conversation.supportStatus].icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/admin/support")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-border/50 bg-card/50 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <UserAvatar
                  type="chat"
                  name={conversation.supportCreatedByUser?.displayName ?? "User"}
                  avatarUrl={conversation.supportCreatedByUser?.avatarUrl}
                  className="size-12"
                />
                <div>
                  <p className="font-semibold text-foreground">
                    {conversation.supportCreatedByUser?.displayName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {conversation.supportCreatedByUser?.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Yêu cầu vào {formatDate(conversation.createdAt)}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
                  statusConfig[conversation.supportStatus].className
                }`}
              >
                <StatusIcon className="h-4 w-4" />
                {statusConfig[conversation.supportStatus].label}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-card/50 p-6">
            <h3 className="mb-4 font-semibold text-foreground">Cuộc trò chuyện</h3>
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground">Chưa có tin nhắn nào.</p>
              ) : (
                messages.map((message) =>
                  message.type === "system" ? (
                    <div key={message._id} className="flex justify-center">
                      <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    <div
                      key={message._id}
                      className={`flex ${
                        message.senderId === currentUserId ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-xs rounded-2xl px-4 py-2 ${
                          message.senderId === currentUserId
                            ? "bg-primary text-primary-foreground"
                            : "bg-blue-500/10 text-foreground"
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p
                          className={`mt-1 text-xs ${
                            message.senderId === currentUserId
                              ? "text-primary-foreground/80"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formatDate(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  ),
                )
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-card/50 p-6">
            <h3 className="mb-4 font-semibold text-foreground">Phản hồi</h3>
            <div className="space-y-4">
              <textarea
                placeholder="Nhập phản hồi cho người dùng..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="min-h-24 w-full resize-none rounded-lg border border-border/50 bg-muted/50 px-4 py-3 placeholder-muted-foreground focus:border-primary/50 focus:outline-none"
              />
              <Button
                onClick={handleSendReply}
                disabled={sending || !replyContent.trim()}
                className="w-full gap-2"
              >
                {sending ? (
                  <>
                    <LoadingSpinner className="h-4 w-4" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Gửi phản hồi
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border/50 bg-card/50 p-6">
            <h3 className="mb-4 font-semibold text-foreground">Thông tin</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Trạng thái</p>
                <p className="font-medium text-foreground capitalize">
                  {statusConfig[conversation.supportStatus].label}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Admin xử lý</p>
                <p className="font-medium text-foreground">
                  {conversation.assignedAdmin?.displayName ?? "Chưa assign"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Tạo lúc</p>
                <p className="font-medium text-foreground">
                  {formatDate(conversation.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Cập nhật lúc</p>
                <p className="font-medium text-foreground">
                  {formatDate(conversation.updatedAt)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-card/50 p-6">
            <h3 className="mb-4 font-semibold text-foreground">Cập nhật trạng thái</h3>
            <div className="space-y-2">
              {(["open", "in_progress", "resolved", "closed"] as const).map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={newStatus === status ? "default" : "outline"}
                  className="w-full justify-start capitalize"
                  onClick={() => handleStatusChange(status)}
                  disabled={sending}
                >
                  <Check className="mr-2 h-4 w-4" />
                  {statusConfig[status].label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSupportDetail;
