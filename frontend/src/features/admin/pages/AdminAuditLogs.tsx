import { useEffect, useState } from "react";

import AdminPagination from "@/features/admin/components/AdminPagination";
import { Input } from "@/shared/ui/input";
import { LoadingSpinner } from "@/shared/ui/loading-spinner";
import RoleBadge from "@/features/admin/components/RoleBadge";
import { adminRoleService } from "@/features/admin/services/adminRoleService";

type AuditLogItem = Awaited<ReturnType<typeof adminRoleService.getAuditLogs>>["logs"][number];
type PaginationData = Awaited<ReturnType<typeof adminRoleService.getAuditLogs>>["pagination"];

const defaultPagination: PaginationData = {
  page: 1,
  limit: 20,
  total: 0,
  pages: 1,
};

const formatDateTime = (value?: string) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Không có";

const AdminAuditLogs = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [pagination, setPagination] = useState<PaginationData>(defaultPagination);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actorQ, setActorQ] = useState("");
  const [targetQ, setTargetQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const data = await adminRoleService.getAuditLogs({
          page,
          limit: 20,
          actorQ,
          targetQ,
          from,
          to,
          action: "USER_ROLE_UPDATED",
        });
        setLogs(data.logs);
        setPagination(data.pagination);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [actorQ, from, page, targetQ, to]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Lịch sử phân quyền</h1>
        <p className="mt-2 text-muted-foreground">
          Theo dõi ai đã thay đổi quyền, thay đổi cho ai và vì lý do gì.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-border/50 bg-card/50 p-4 md:grid-cols-4">
        <Input
          value={actorQ}
          onChange={(event) => {
            setActorQ(event.target.value);
            setPage(1);
          }}
          placeholder="Tìm theo người thực hiện..."
        />
        <Input
          value={targetQ}
          onChange={(event) => {
            setTargetQ(event.target.value);
            setPage(1);
          }}
          placeholder="Tìm theo tài khoản bị đổi..."
        />
        <Input
          type="date"
          value={from}
          onChange={(event) => {
            setFrom(event.target.value);
            setPage(1);
          }}
        />
        <Input
          type="date"
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        {loading ? (
          <div className="flex h-80 items-center justify-center">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex h-80 items-center justify-center text-muted-foreground">
            Chưa có bản ghi phân quyền nào.
          </div>
        ) : (
          <>
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Thời gian</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Người thực hiện</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Tài khoản bị đổi</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Từ role</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Sang role</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Lý do</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} className="border-b border-border/50">
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <p className="font-medium text-foreground">
                        {log.actor?.displayName ?? "Không rõ"}
                      </p>
                      <p className="text-muted-foreground">@{log.actor?.userName ?? "-"}</p>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <p className="font-medium text-foreground">
                        {log.targetUser?.displayName ?? "Không rõ"}
                      </p>
                      <p className="text-muted-foreground">@{log.targetUser?.userName ?? "-"}</p>
                    </td>
                    <td className="px-6 py-4">
                      {log.beforeData?.role ? <RoleBadge role={log.beforeData.role} /> : "-"}
                    </td>
                    <td className="px-6 py-4">
                      {log.afterData?.role ? <RoleBadge role={log.afterData.role} /> : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {log.reason || "-"}
                    </td>
                  </tr>
                ))}
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

export default AdminAuditLogs;
