import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import UserAvatar from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { axiosInstance } from "@/lib/axios";
import { Textarea } from "@/components/ui/textarea";

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

interface ReportDetail {
  _id: string;
  reporterId: string;
  targetType: "user" | "message" | "conversation";
  targetUserId?: string;
  targetMessageId?: string;
  targetConversationId?: string;
  reason: string;
  description?: string;
  status: "pending" | "reviewing" | "resolved" | "rejected";
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

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-500/10 text-yellow-700",
  },
  reviewing: {
    label: "Reviewing",
    className: "bg-blue-500/10 text-blue-700",
  },
  resolved: {
    label: "Resolved",
    className: "bg-emerald-500/10 text-emerald-700",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-500/10 text-red-700",
  },
};

const typeConfig: Record<string, { label: string; className: string }> = {
  user: {
    label: "User Report",
    className: "bg-purple-500/10 text-purple-700",
  },
  message: {
    label: "Message Report",
    className: "bg-blue-500/10 text-blue-700",
  },
  conversation: {
    label: "Conversation Report",
    className: "bg-amber-500/10 text-amber-700",
  },
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "No date";

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

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const [resolutionNote, setResolutionNote] = useState("");
  const [reviewingDialogOpen, setReviewingDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  useEffect(() => {
    void fetchReportDetail();
  }, [id]);

  const fetchReportDetail = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await axiosInstance.get(`/admin/reports/${id}`);
      setReport(response.data.data.report);
      setResolutionNote(response.data.data.report.resolutionNote || "");
    } catch (err) {
      console.error(err);
      setError("Failed to load report.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!report) return;

    try {
      setUpdating(true);

      const response = await axiosInstance.patch(`/admin/reports/${report._id}/status`, {
        status: newStatus,
        resolutionNote: newStatus === "resolved" || newStatus === "rejected" ? resolutionNote : undefined,
      });

      setReport(response.data.data.report);
      toast.success("Report status updated");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const handleResolveWithAction = async () => {
    if (!report || !selectedAction) return;

    try {
      setUpdating(true);

      const response = await axiosInstance.patch(`/admin/reports/${report._id}/resolve-with-action`, {
        action: selectedAction,
        resolutionNote,
      });

      setReport(response.data.data.report);
      setActionDialogOpen(false);
      setSelectedAction(null);
      toast.success("Report resolved with action");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to resolve with action");
    } finally {
      setUpdating(false);
    }
  };

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin/reports")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin/reports")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Report Details</h1>
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
              statusConfig[report.status].className
            }`}
          >
            {statusConfig[report.status].label}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Reporter Section */}
          <div className="rounded-xl border border-border/50 bg-card/50 p-6">
            <h2 className="text-lg font-semibold text-foreground">Reporter Information</h2>
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
                <p className="text-sm text-muted-foreground">@{report.reporterSnapshot.userName}</p>
              </div>
            </div>
          </div>

          {/* Report Reason Section */}
          <div className="rounded-xl border border-border/50 bg-card/50 p-6">
            <h2 className="text-lg font-semibold text-foreground">Reason</h2>
            <p className="mt-3 text-muted-foreground">{report.reason}</p>

            {report.description && (
              <>
                <h3 className="mt-4 font-medium text-foreground">Description</h3>
                <p className="mt-2 text-muted-foreground">{report.description}</p>
              </>
            )}

            <div className="mt-4 flex gap-2">
              <span className="inline-block rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                Created: {formatDate(report.createdAt)}
              </span>
              {report.reviewedAt && (
                <span className="inline-block rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                  Reviewed: {formatDate(report.reviewedAt)}
                </span>
              )}
            </div>
          </div>

          {/* Target Content Section */}
          {report.targetType === "user" && report.targetUserSnapshot && (
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-6">
              <h2 className="text-lg font-semibold text-foreground">Reported User</h2>
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
                  <p className="text-sm text-muted-foreground">@{report.targetUserSnapshot.userName}</p>
                  {report.targetUserSnapshot.email && (
                    <p className="text-xs text-muted-foreground">{report.targetUserSnapshot.email}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {report.targetType === "message" && report.targetMessagePreview && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-6">
              <h2 className="text-lg font-semibold text-foreground">Reported Message</h2>
              <div className="mt-4 space-y-3">
                {report.targetMessagePreview.content && (
                  <div className="rounded-lg bg-background/50 p-4">
                    <p className="text-sm text-muted-foreground">
                      {report.targetMessagePreview.content}
                    </p>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  <p>Sent by: {report.targetMessagePreview.senderDisplayName}</p>
                  <p>{formatDate(report.targetMessagePreview.createdAt)}</p>
                </div>
              </div>
            </div>
          )}

          {report.targetType === "conversation" && report.targetConversationSnapshot && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
              <h2 className="text-lg font-semibold text-foreground">Reported Conversation</h2>
              <div className="mt-4 space-y-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Type</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {report.targetConversationSnapshot.type}
                  </p>
                </div>
                {report.targetConversationSnapshot.groupName && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Name</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {report.targetConversationSnapshot.groupName}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Members</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {report.targetConversationSnapshot.membersCount}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Resolution Note Section */}
          {report.resolutionNote && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
              <h2 className="text-lg font-semibold text-foreground">Resolution Note</h2>
              <p className="mt-3 text-muted-foreground">{report.resolutionNote}</p>
            </div>
          )}
        </div>

        {/* Sidebar - Actions */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card/50 p-6">
            <h3 className="font-semibold text-foreground">Actions</h3>

            <div className="mt-4 space-y-3">
              {report.status === "pending" && (
                <Button
                  onClick={() => handleUpdateStatus("reviewing")}
                  disabled={updating}
                  className="w-full gap-2"
                  variant="outline"
                >
                  {updating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Start Reviewing
                </Button>
              )}

              {report.status !== "resolved" && report.status !== "rejected" && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Resolution Note
                    </label>
                    <Textarea
                      placeholder="Enter resolution note..."
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      className="resize-none"
                      rows={4}
                    />
                  </div>

                  <Button
                    onClick={() => handleUpdateStatus("resolved")}
                    disabled={updating || !resolutionNote.trim()}
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {updating && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Check className="h-4 w-4" />
                    Resolve
                  </Button>

                  <Button
                    onClick={() => handleUpdateStatus("rejected")}
                    disabled={updating}
                    variant="outline"
                    className="w-full gap-2 text-red-600 hover:bg-red-500/10"
                  >
                    {updating && <Loader2 className="h-4 w-4 animate-spin" />}
                    <X className="h-4 w-4" />
                    Reject
                  </Button>

                  {report.targetType === "user" && (
                    <Button
                      onClick={() => setActionDialogOpen(true)}
                      disabled={updating}
                      variant="outline"
                      className="w-full gap-2"
                    >
                      {updating && <Loader2 className="h-4 w-4 animate-spin" />}
                      <AlertCircle className="h-4 w-4" />
                      Action on User
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {report.status === "resolved" || report.status === "rejected" ? (
            <div className="rounded-xl border border-border/50 bg-muted/50 p-4 text-sm text-muted-foreground">
              <p>This report has been finalized.</p>
              <p className="mt-2 text-xs">Status: {statusConfig[report.status].label}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Moderation Action</DialogTitle>
            <DialogDescription>
              Choose an action to take against the reported user
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Button
              onClick={() => {
                setSelectedAction("ban-user");
                handleResolveWithAction();
              }}
              disabled={updating}
              className="w-full gap-2 justify-start"
              variant="outline"
            >
              {updating && <Loader2 className="h-4 w-4 animate-spin" />}
              Ban User
            </Button>

            <Button
              onClick={() => {
                setSelectedAction("delete-message");
                handleResolveWithAction();
              }}
              disabled={updating}
              className="w-full gap-2 justify-start"
              variant="outline"
            >
              {updating && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete Associated Content
            </Button>

            <Button
              onClick={() => setActionDialogOpen(false)}
              disabled={updating}
              variant="ghost"
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReportDetail;
