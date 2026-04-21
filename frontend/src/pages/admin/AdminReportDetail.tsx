import { useEffect, useState } from "react";
import { getErrorMeta, logger } from "@/lib/logger";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Check, Loader2, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

import AdminDeleteUserDialog from "@/components/admin/AdminDeleteUserDialog";
import AdminUserStatusDialog from "@/components/admin/AdminUserStatusDialog";
import UserAvatar from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Textarea } from "@/components/ui/textarea";
import { axiosInstance } from "@/lib/axios";
import { useAdminSocketStore } from "@/stores/useAdminSocketStore";

type ReportStatus = "pending" | "reviewing" | "resolved" | "rejected";
type UserStatus = "active" | "inactive" | "suspended" | "banned" | "deleted";

interface ReporterSnapshot {
  _id: string;
  displayName: string;
  userName: string;
  avatarUrl?: string;
}

interface TargetUserSnapshot {
  _id: string;
  displayName: string;
  userName: string;
  email?: string;
  avatarUrl?: string;
}

interface TargetMessagePreview {
  _id: string;
  content?: string;
  imgUrl?: string;
  senderDisplayName?: string;
  createdAt: string;
}

interface ModerationTargetUser {
  _id: string | null;
  displayName: string;
  userName: string;
  email?: string | null;
  avatarUrl?: string | null;
  status: UserStatus;
  source: "target_user" | "message_sender" | "message_sender_deleted";
}

interface ReportDetail {
  _id: string;
  reporterId: string;
  targetType: "user" | "message" | "conversation";
  targetUserId?: string;
  targetMessageId?: string;
  targetConversationId?: string;
  reason: string;
  description?: string;
  status: ReportStatus;
  reviewedByAdminId?: string;
  reviewedAt?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
  reporterSnapshot: ReporterSnapshot;
  targetUserSnapshot?: TargetUserSnapshot;
  targetMessagePreview?: TargetMessagePreview;
  targetConversationSnapshot?: {
    _id: string;
    type: string;
    groupName?: string;
    membersCount: number;
  };
}

const reportStatusConfig: Record<ReportStatus, { label: string; className: string }> = {
  pending: {
    label: "Chờ xử lý",
    className: "bg-yellow-500/10 text-yellow-700",
  },
  reviewing: {
    label: "Đang xem xét",
    className: "bg-blue-500/10 text-blue-700",
  },
  resolved: {
    label: "Đã xử lý",
    className: "bg-emerald-500/10 text-emerald-700",
  },
  rejected: {
    label: "Từ chối",
    className: "bg-red-500/10 text-red-700",
  },
};

const typeConfig: Record<
  ReportDetail["targetType"],
  { label: string; className: string }
> = {
  user: {
    label: "Báo cáo người dùng",
    className: "bg-purple-500/10 text-purple-700",
  },
  message: {
    label: "Báo cáo tin nhắn",
    className: "bg-blue-500/10 text-blue-700",
  },
  conversation: {
    label: "Báo cáo cuộc trò chuyện",
    className: "bg-amber-500/10 text-amber-700",
  },
};

const userStatusConfig: Record<UserStatus, { label: string; className: string }> = {
  active: {
    label: "Hoạt động",
    className: "bg-emerald-500/10 text-emerald-700",
  },
  banned: {
    label: "Bị khóa",
    className: "bg-rose-500/10 text-rose-700",
  },
  inactive: {
    label: "Không hoạt động",
    className: "bg-slate-500/10 text-slate-700",
  },
  suspended: {
    label: "Tạm khóa",
    className: "bg-amber-500/10 text-amber-700",
  },
  deleted: {
    label: "Đã xóa",
    className: "bg-slate-700/10 text-slate-700",
  },
};

const isModeratableStatus = (
  status: UserStatus,
): status is "active" | "inactive" | "suspended" | "banned" =>
  status !== "deleted";

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "Không có ngày";

  return new Date(dateString).toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AdminReportDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reports = useAdminSocketStore((state) => state.reports);

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [moderationTargetUser, setModerationTargetUser] =
    useState<ModerationTargetUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");

  const fetchReportDetail = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await axiosInstance.get(`/admin/reports/${id}`);
      setReport(response.data.data.report);
      setModerationTargetUser(response.data.data.moderationTargetUser ?? null);
      setResolutionNote(response.data.data.report.resolutionNote || "");
    } catch (err) {
      logger.error("Khong the tai chi tiet bao cao admin", getErrorMeta(err));
      setError("Không thể tải chi tiết báo cáo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReportDetail();
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }

    const realtimeReport = reports.find((item) => item._id === id);
    if (!realtimeReport) {
      return;
    }

    setReport((current) =>
      current
        ? {
            ...current,
            ...realtimeReport,
          }
        : current,
    );
  }, [id, reports]);

  const handleUpdateStatus = async (newStatus: ReportStatus) => {
    if (!report) return;

    try {
      setUpdating(true);

      const response = await axiosInstance.patch(`/admin/reports/${report._id}/status`, {
        status: newStatus,
        resolutionNote:
          newStatus === "resolved" || newStatus === "rejected"
            ? resolutionNote || undefined
            : undefined,
      });

      setReport(response.data.data.report);
      setResolutionNote(response.data.data.report.resolutionNote || resolutionNote);
      toast.success("Đã cập nhật trạng thái báo cáo.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Không thể cập nhật trạng thái báo cáo.");
    } finally {
      setUpdating(false);
    }
  };

  const markReportResolved = async (note: string) => {
    if (!report || report.status === "resolved") {
      return;
    }

    try {
      const response = await axiosInstance.patch(`/admin/reports/${report._id}/status`, {
        status: "resolved",
        resolutionNote: note,
      });

      setReport(response.data.data.report);
      setResolutionNote(response.data.data.report.resolutionNote || note);
    } catch (error) {
      logger.error("Khong the tu dong danh dau bao cao da xu ly", getErrorMeta(error));
    }
  };

  const handleAccountStatusSuccess = async (nextStatus: "active" | "banned") => {
    const note =
      nextStatus === "banned" ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản";

    setModerationTargetUser((current) =>
      current
        ? {
            ...current,
            status: nextStatus,
          }
        : current,
    );

    await markReportResolved(note);
    await fetchReportDetail();
  };

  const handleDeleteAccountSuccess = async () => {
    setModerationTargetUser((current) =>
      current
        ? {
            ...current,
            status: "deleted",
          }
        : current,
    );

    await markReportResolved("Đã xóa tài khoản");
    await fetchReportDetail();
  };

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/admin/reports")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>
        </div>

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (loading || !report) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }

  const moderationStatus =
    moderationTargetUser?.status && userStatusConfig[moderationTargetUser.status]
      ? userStatusConfig[moderationTargetUser.status]
      : null;
  const moderatableTargetUser =
    moderationTargetUser &&
    moderationTargetUser._id &&
    isModeratableStatus(moderationTargetUser.status)
      ? moderationTargetUser
      : null;
  const canModerateAccount = !!moderatableTargetUser;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/admin/reports")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Chi tiết báo cáo</h1>
            <p className="mt-1 text-sm text-muted-foreground">ID: {report._id}</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              typeConfig[report.targetType].className
            }`}
          >
            {typeConfig[report.targetType].label}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              reportStatusConfig[report.status].className
            }`}
          >
            {reportStatusConfig[report.status].label}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-border/50 bg-card/50 p-6">
            <h2 className="text-lg font-semibold text-foreground">Người báo cáo</h2>
            <div className="mt-4 flex items-center gap-4">
              <UserAvatar
                type="chat"
                name={report.reporterSnapshot.displayName}
                avatarUrl={report.reporterSnapshot.avatarUrl}
                className="size-14"
              />
              <div>
                <p className="font-medium text-foreground">
                  {report.reporterSnapshot.displayName}
                </p>
                <p className="text-sm text-muted-foreground">
                  @{report.reporterSnapshot.userName}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-card/50 p-6">
            <h2 className="text-lg font-semibold text-foreground">Nội dung báo cáo</h2>
            <p className="mt-3 text-muted-foreground">{report.reason}</p>

            {report.description ? (
              <>
                <h3 className="mt-4 font-medium text-foreground">Mô tả</h3>
                <p className="mt-2 text-muted-foreground">{report.description}</p>
              </>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-block rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                Tạo lúc: {formatDate(report.createdAt)}
              </span>
              {report.reviewedAt ? (
                <span className="inline-block rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                  Đã xem: {formatDate(report.reviewedAt)}
                </span>
              ) : null}
            </div>
          </div>

          {report.targetType === "user" && report.targetUserSnapshot ? (
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-6">
              <h2 className="text-lg font-semibold text-foreground">Người dùng bị báo cáo</h2>
              <div className="mt-4 flex items-center gap-4">
                <UserAvatar
                  type="chat"
                  name={report.targetUserSnapshot.displayName}
                  avatarUrl={report.targetUserSnapshot.avatarUrl}
                  className="size-14"
                />
                <div>
                  <p className="font-medium text-foreground">
                    {report.targetUserSnapshot.displayName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    @{report.targetUserSnapshot.userName}
                  </p>
                  {report.targetUserSnapshot.email ? (
                    <p className="text-xs text-muted-foreground">
                      {report.targetUserSnapshot.email}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {report.targetType === "message" && report.targetMessagePreview ? (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-6">
              <h2 className="text-lg font-semibold text-foreground">Tin nhắn bị báo cáo</h2>
              <div className="mt-4 space-y-3">
                {report.targetMessagePreview.content ? (
                  <div className="rounded-lg bg-background/50 p-4">
                    <p className="text-sm text-muted-foreground">
                      {report.targetMessagePreview.content}
                    </p>
                  </div>
                ) : null}
                <div className="text-xs text-muted-foreground">
                  <p>Người gửi: {report.targetMessagePreview.senderDisplayName}</p>
                  <p>{formatDate(report.targetMessagePreview.createdAt)}</p>
                </div>
              </div>
            </div>
          ) : null}

          {report.targetType === "conversation" && report.targetConversationSnapshot ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
              <h2 className="text-lg font-semibold text-foreground">Cuộc trò chuyện bị báo cáo</h2>
              <div className="mt-4 space-y-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Loại</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {report.targetConversationSnapshot.type}
                  </p>
                </div>
                {report.targetConversationSnapshot.groupName ? (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Tên</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {report.targetConversationSnapshot.groupName}
                    </p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Số thành viên
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {report.targetConversationSnapshot.membersCount}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {report.resolutionNote ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
              <h2 className="text-lg font-semibold text-foreground">Ghi chú xử lý</h2>
              <p className="mt-3 text-muted-foreground">{report.resolutionNote}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card/50 p-6">
            <h3 className="font-semibold text-foreground">Xử lý báo cáo</h3>

            <div className="mt-4 space-y-3">
              {report.status === "pending" ? (
                <Button
                  onClick={() => handleUpdateStatus("reviewing")}
                  disabled={updating}
                  className="w-full gap-2"
                  variant="outline"
                >
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Bắt đầu xem xét
                </Button>
              ) : null}

              {report.status !== "resolved" && report.status !== "rejected" ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Ghi chú xử lý
                    </label>
                    <Textarea
                      placeholder="Nhập ghi chú xử lý..."
                      value={resolutionNote}
                      onChange={(event) => setResolutionNote(event.target.value)}
                      className="resize-none"
                      rows={4}
                    />
                  </div>

                  <Button
                    onClick={() => handleUpdateStatus("resolved")}
                    disabled={updating || !resolutionNote.trim()}
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Đánh dấu đã xử lý
                  </Button>

                  <Button
                    onClick={() => handleUpdateStatus("rejected")}
                    disabled={updating}
                    variant="outline"
                    className="w-full gap-2 text-red-600 hover:bg-red-500/10"
                  >
                    {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    Từ chối báo cáo
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-card/50 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-foreground">Xử lý tài khoản</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reuse action từ quản lý người dùng để khóa, mở khóa hoặc xóa tài khoản.
                </p>
              </div>
              {moderationStatus ? (
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${moderationStatus.className}`}
                >
                  {moderationStatus.label}
                </span>
              ) : null}
            </div>

            {moderationTargetUser ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-background/40 p-4">
                  <UserAvatar
                    type="chat"
                    name={moderationTargetUser.displayName}
                    avatarUrl={moderationTargetUser.avatarUrl ?? undefined}
                    className="size-12"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {moderationTargetUser.displayName}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      @{moderationTargetUser.userName}
                    </p>
                    {moderationTargetUser.email ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {moderationTargetUser.email}
                      </p>
                    ) : null}
                  </div>
                </div>

                {canModerateAccount ? (
                  <div className="space-y-3">
                    <AdminUserStatusDialog
                      userId={moderatableTargetUser!._id!}
                      userName={moderatableTargetUser!.userName}
                      displayName={moderatableTargetUser!.displayName}
                      currentStatus={moderatableTargetUser!.status as "active" | "inactive" | "suspended" | "banned"}
                      fullWidth
                      onSuccess={handleAccountStatusSuccess}
                    />

                    <AdminDeleteUserDialog
                      userId={moderatableTargetUser!._id!}
                      userName={moderatableTargetUser!.userName}
                      displayName={moderatableTargetUser!.displayName}
                      fullWidth
                      redirectToUsers={false}
                      onSuccess={handleDeleteAccountSuccess}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/50 bg-muted/40 p-4 text-sm text-muted-foreground">
                    {moderationTargetUser.status === "deleted"
                      ? "Tài khoản này đã bị xóa. Các thao tác khóa, mở khóa và xóa đều đã bị vô hiệu hóa."
                      : "Không xác định được user đích để xử lý trực tiếp từ báo cáo này."}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-border/50 bg-muted/40 p-4 text-sm text-muted-foreground">
                Với loại báo cáo này hiện không xác định rõ tài khoản đích để xử lý trực tiếp.
              </div>
            )}
          </div>

          {report.status === "resolved" || report.status === "rejected" ? (
            <div className="rounded-xl border border-border/50 bg-muted/50 p-4 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4" />
                <div>
                  <p>Báo cáo này đã được chốt.</p>
                  <p className="mt-1 text-xs">
                    Trạng thái: {reportStatusConfig[report.status].label}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AdminReportDetail;
