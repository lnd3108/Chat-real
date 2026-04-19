import { useEffect, useState } from "react";
import { Eye, Search, Flag, AlertCircle } from "lucide-react";

import AdminPagination from "@/components/admin/AdminPagination";
import UserAvatar from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { axiosInstance } from "@/lib/axios";

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

interface Report {
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

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
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

const AdminReports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"" | "pending" | "reviewing" | "resolved" | "rejected">("");
  const [typeFilter, setTypeFilter] = useState<"" | "user" | "message" | "conversation">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("createdAt-desc");
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    void fetchReports();
  }, [page, statusFilter, typeFilter, searchQuery, sortBy]);

  useEffect(() => {
    if (!detailOpen || !selectedReportId) {
      return;
    }

    void fetchReportDetail(selectedReportId);
  }, [detailOpen, selectedReportId]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axiosInstance.get("/admin/reports", {
        params: {
          page,
          limit: 20,
          status: statusFilter,
          targetType: typeFilter,
          q: searchQuery,
          sort: sortBy,
        },
      });

      setReports(response.data.data.reports ?? []);
      setPagination(response.data.data.pagination);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch reports.");
    } finally {
      setLoading(false);
    }
  };

  const fetchReportDetail = async (reportId: string) => {
    try {
      setDetailLoading(true);
      const response = await axiosInstance.get(`/admin/reports/${reportId}`);
      setSelectedReport(response.data.data.report);
    } catch (err) {
      console.error(err);
      setSelectedReport(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleStatusChange = (value: "" | "pending" | "reviewing" | "resolved" | "rejected") => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleTypeChange = (value: "" | "user" | "message" | "conversation") => {
    setTypeFilter(value);
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    setPage(1);
  };

  const handleOpenDetail = (reportId: string) => {
    setSelectedReportId(reportId);
    setSelectedReport(null);
    setDetailOpen(true);
  };

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Reports</h1>
          <p className="mt-2 text-muted-foreground">
            Manage and review user reports for moderation.
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
        <h1 className="text-3xl font-bold text-foreground">Admin Reports</h1>
        <p className="mt-2 text-muted-foreground">
          Total {pagination.total} reports to manage and review.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-amber-700" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Privacy Notice</p>
            <p className="text-sm text-muted-foreground">
              Admin can only view content related to specific reports. No mass browsing of user messages is allowed.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by reason or reporter..."
              value={searchQuery}
              onChange={(event) => handleSearch(event.target.value)}
              className="border-border/50 bg-muted/50 pl-10 focus:border-primary/50"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => handleStatusChange(event.target.value as any)}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="reviewing">Reviewing</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={typeFilter}
            onChange={(event) => handleTypeChange(event.target.value as any)}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="user">User</option>
            <option value="message">Message</option>
            <option value="conversation">Conversation</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => handleSortChange(event.target.value)}
            className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/50 focus:outline-none"
          >
            <option value="createdAt-desc">Newest First</option>
            <option value="createdAt-asc">Oldest First</option>
            <option value="updated">Recently Updated</option>
            <option value="status">By Status</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <Flag className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">No reports found.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your filters or search query.
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
                      Reporter
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Reason
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Created
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr
                      key={report._id}
                      className="border-b border-border/50 transition-colors hover:bg-muted/30"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            type="chat"
                            name={report.reporterSnapshot.displayName}
                            avatarUrl={report.reporterSnapshot.avatarUrl}
                            className="size-9"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {report.reporterSnapshot.displayName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              @{report.reporterSnapshot.userName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                            typeConfig[report.targetType].className
                          }`}
                        >
                          {typeConfig[report.targetType].label}
                        </span>
                      </td>
                      <td className="max-w-[300px] px-6 py-4 text-sm text-muted-foreground">
                        <span className="line-clamp-2">{report.reason}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                            statusConfig[report.status].className
                          }`}
                        >
                          {statusConfig[report.status].label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatDate(report.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-10 rounded-xl border border-border/50 bg-background/40 px-3 text-muted-foreground hover:bg-background/70 hover:text-foreground"
                          onClick={() => handleOpenDetail(report._id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
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
            setSelectedReportId(null);
            setSelectedReport(null);
          }
        }}
      >
        <DialogContent className="border-border/40 bg-card/95 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
            <DialogDescription>
              Review and manage this report
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !selectedReport ? (
            <div className="flex h-64 items-center justify-center">
              <LoadingSpinner className="h-8 w-8" />
            </div>
          ) : (
            <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                    typeConfig[selectedReport.targetType].className
                  }`}
                >
                  {typeConfig[selectedReport.targetType].label}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                    statusConfig[selectedReport.status].className
                  }`}
                >
                  {statusConfig[selectedReport.status].label}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border/50 bg-card/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Report ID
                  </p>
                  <p className="mt-2 break-all font-mono text-sm text-foreground">
                    {selectedReport._id}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-card/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Created At
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {formatDate(selectedReport.createdAt)}
                  </p>
                </div>
              </div>

              {/* Reporter Info */}
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">Reporter</p>
                <div className="mt-3 flex items-center gap-3">
                  <UserAvatar
                    type="chat"
                    name={selectedReport.reporterSnapshot.displayName}
                    avatarUrl={selectedReport.reporterSnapshot.avatarUrl}
                    className="size-10"
                  />
                  <div>
                    <p className="font-medium text-foreground">
                      {selectedReport.reporterSnapshot.displayName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      @{selectedReport.reporterSnapshot.userName}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reason and Description */}
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">Reason</p>
                <p className="mt-2 text-sm text-muted-foreground">{selectedReport.reason}</p>

                {selectedReport.description && (
                  <>
                    <p className="mt-4 text-sm font-medium text-foreground">Description</p>
                    <p className="mt-2 text-sm text-muted-foreground">{selectedReport.description}</p>
                  </>
                )}
              </div>

              {/* Target Info - User Report */}
              {selectedReport.targetType === "user" && selectedReport.targetUserSnapshot && (
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
                  <p className="text-sm font-medium text-foreground">Reported User</p>
                  <div className="mt-3 flex items-center gap-3">
                    <UserAvatar
                      type="chat"
                      name={selectedReport.targetUserSnapshot.displayName}
                      avatarUrl={selectedReport.targetUserSnapshot.avatarUrl}
                      className="size-10"
                    />
                    <div>
                      <p className="font-medium text-foreground">
                        {selectedReport.targetUserSnapshot.displayName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        @{selectedReport.targetUserSnapshot.userName}
                      </p>
                      {selectedReport.targetUserSnapshot.email && (
                        <p className="text-xs text-muted-foreground">{selectedReport.targetUserSnapshot.email}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Target Info - Message Report */}
              {selectedReport.targetType === "message" && selectedReport.targetMessagePreview && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
                  <p className="text-sm font-medium text-foreground">Reported Message</p>
                  <div className="mt-3 space-y-2">
                    {selectedReport.targetMessagePreview.content && (
                      <div className="rounded-lg bg-background/50 p-3">
                        <p className="text-sm text-muted-foreground">
                          {selectedReport.targetMessagePreview.content}
                        </p>
                      </div>
                    )}
                    {selectedReport.targetMessagePreview.imgUrl && (
                      <div className="rounded-lg bg-background/50 p-3">
                        <p className="text-xs text-muted-foreground">Image attached</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Sent by {selectedReport.targetMessagePreview.senderDisplayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(selectedReport.targetMessagePreview.createdAt)}
                    </p>
                  </div>
                </div>
              )}

              {/* Target Info - Conversation Report */}
              {selectedReport.targetType === "conversation" && selectedReport.targetConversationSnapshot && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <p className="text-sm font-medium text-foreground">Reported Conversation</p>
                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Type: {selectedReport.targetConversationSnapshot.type}
                    </p>
                    {selectedReport.targetConversationSnapshot.groupName && (
                      <p className="text-sm text-muted-foreground">
                        Name: {selectedReport.targetConversationSnapshot.groupName}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Members: {selectedReport.targetConversationSnapshot.membersCount}
                    </p>
                  </div>
                </div>
              )}

              {/* Resolution Note */}
              {selectedReport.resolutionNote && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <p className="text-sm font-medium text-foreground">Resolution Note</p>
                  <p className="mt-2 text-sm text-muted-foreground">{selectedReport.resolutionNote}</p>
                </div>
              )}

              {/* Reviewed Info */}
              {selectedReport.reviewedByAdminId && (
                <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Reviewed By
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    Admin
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(selectedReport.reviewedAt)}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReports;
