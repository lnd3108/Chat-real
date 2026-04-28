import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import RoleBadge from "@/features/admin/components/RoleBadge";
import UserAvatar from "@/features/chat/components/UserAvatar";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { getErrorMessage } from "@/shared/lib/httpError";
import { APP_ROLES, getRoleLabel, type AppRole } from "@/shared/lib/rbac";
import { adminRoleService } from "@/features/admin/services/adminRoleService";
import type { AdminUserRecord } from "@/shared/types/admin";

interface UpdateUserRoleModalProps {
  user: AdminUserRecord;
  triggerClassName?: string;
  fullWidth?: boolean;
  onSuccess?: (user: AdminUserRecord) => void;
}

const UpdateUserRoleModal = ({
  user,
  triggerClassName,
  fullWidth = false,
  onSuccess,
}: UpdateUserRoleModalProps) => {
  const [open, setOpen] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [nextRole, setNextRole] = useState<AppRole>(user.role);
  const [confirmed, setConfirmed] = useState(false);
  const [roleOptions, setRoleOptions] = useState<
    Array<{ key: AppRole; label: string; assignable: boolean }>
  >([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const run = async () => {
      try {
        setLoadingOptions(true);
        const data = await adminRoleService.getRoles();
        const options = data.roles.filter((role) => role.assignable);
        setRoleOptions(options);

        const fallbackRole =
          options.find((option) => option.key === user.role)?.key ?? options[0]?.key ?? user.role;
        setNextRole(fallbackRole);
      } catch (error) {
        toast.error(getErrorMessage(error, "Không thể tải danh sách role."));
      } finally {
        setLoadingOptions(false);
      }
    };

    void run();
  }, [open, user.role]);

  const currentRole = useMemo(() => user.role, [user.role]);
  const roleChanged = currentRole !== nextRole;

  const handleSubmit = async () => {
    if (!roleChanged || !confirmed) {
      return;
    }

    try {
      setSubmitting(true);
      const result = await adminRoleService.updateUserRole(user._id, {
        role: nextRole,
        reason,
      });
      onSuccess?.(result.user as AdminUserRecord);
      toast.success("Cập nhật quyền tài khoản thành công.");
      setOpen(false);
      setReason("");
      setConfirmed(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể cập nhật quyền tài khoản."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={`${fullWidth ? "w-full justify-start" : ""} ${triggerClassName ?? ""}`.trim()}
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          Phân quyền
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Phân quyền tài khoản</DialogTitle>
          <DialogDescription>
            Chỉ cập nhật vai trò khi đã xác minh đúng phạm vi trách nhiệm của tài khoản này.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
            <div className="flex items-center gap-4">
              <UserAvatar
                type="chat"
                name={user.displayName}
                avatarUrl={user.avatarUrl ?? undefined}
                className="size-14"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-foreground">{user.displayName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  @{user.userName} • {user.email}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <RoleBadge role={user.role} />
                <span className="text-xs text-muted-foreground">
                  Trạng thái: {user.status === "banned" ? "Bị khóa" : "Hoạt động"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="next-role">Role mới</Label>
            <select
              id="next-role"
              value={nextRole}
              onChange={(event) => setNextRole(event.target.value as AppRole)}
              disabled={loadingOptions || submitting}
              className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
            >
              {roleOptions.map((role) => (
                <option key={role.key} value={role.key}>
                  {role.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Role hiện tại: <span className="font-medium">{getRoleLabel(currentRole)}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-reason">Lý do thay đổi</Label>
            <Textarea
              id="role-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Nhập lý do phân quyền, ví dụ: điều chuyển sang nhóm hỗ trợ ca tối..."
              className="min-h-24"
              disabled={submitting}
            />
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1"
              disabled={submitting}
            />
            <span className="text-muted-foreground">
              Tôi xác nhận thay đổi quyền này là cần thiết và đã kiểm tra đúng phạm vi thao tác.
            </span>
          </label>

          {nextRole === APP_ROLES.ADMIN || nextRole === APP_ROLES.SUPER_ADMIN ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700">
              Vai trò cấp cao chỉ nên gán khi thật sự cần thiết. Backend sẽ tiếp tục kiểm tra quyền
              của tài khoản thao tác trước khi lưu.
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Hủy
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              submitting || loadingOptions || !roleChanged || !confirmed || !String(reason).trim()
            }
          >
            {submitting ? "Đang cập nhật..." : "Xác nhận phân quyền"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateUserRoleModal;
