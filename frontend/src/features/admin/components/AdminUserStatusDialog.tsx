import { useState } from "react";
import { Ban, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { axiosInstance } from "@/shared/api/axios";
import { getErrorMessage } from "@/shared/lib/httpError";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import type { AdminUserStatus } from "@/shared/types/admin";

interface AdminUserStatusDialogProps {
  userId: string;
  userName: string;
  displayName: string;
  currentStatus: AdminUserStatus;
  onSuccess: (nextStatus: "active" | "banned") => void;
  buttonClassName?: string;
  buttonVariant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link";
  fullWidth?: boolean;
  disabled?: boolean;
}

const AdminUserStatusDialog = ({
  userId,
  userName,
  displayName,
  currentStatus,
  onSuccess,
  buttonClassName,
  buttonVariant = "outline",
  fullWidth = false,
  disabled = false,
}: AdminUserStatusDialogProps) => {
  const currentAdminId = useAuthStore((state) => state.user?._id);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isBanned = currentStatus === "banned";
  const nextStatus: "active" | "banned" = isBanned ? "active" : "banned";
  const isSelf = currentAdminId === userId;
  const isDisabled = disabled || isSelf;

  const handleSubmit = async () => {
    if (isDisabled) {
      return;
    }

    try {
      setSubmitting(true);

      await axiosInstance.patch(`/admin/users/${userId}/status`, {
        status: nextStatus,
      });

      onSuccess(nextStatus);
      toast.success(
        nextStatus === "banned"
          ? "Đã khóa tài khoản người dùng."
          : "Đã mở khóa tài khoản người dùng.",
      );
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể cập nhật trạng thái tài khoản."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant={buttonVariant}
          disabled={isDisabled}
          className={`${fullWidth ? "w-full justify-start" : ""} ${buttonClassName ?? ""}`.trim()}
        >
          <Ban className="mr-2 h-4 w-4 shrink-0" />
          {isSelf ? "Không thể tự khóa" : isBanned ? "Mở khóa tài khoản" : "Khóa tài khoản"}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className={isBanned ? "bg-emerald-500/10" : "bg-rose-500/10"}>
            {isBanned ? (
              <ShieldCheck className="text-emerald-600" />
            ) : (
              <ShieldAlert className="text-rose-600" />
            )}
          </AlertDialogMedia>
          <AlertDialogTitle>{isBanned ? "Mở khóa tài khoản" : "Khóa tài khoản"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isBanned
              ? `Tài khoản ${displayName} (@${userName}) sẽ được mở khóa và có thể đăng nhập lại.`
              : `Tài khoản ${displayName} (@${userName}) sẽ bị khóa, không thể đăng nhập, refresh token hay tiếp tục sử dụng app.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Hủy</AlertDialogCancel>
          <Button onClick={handleSubmit} disabled={submitting} variant={isBanned ? "default" : "destructive"}>
            {submitting ? "Đang xử lý..." : isBanned ? "Mở khóa" : "Khóa tài khoản"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AdminUserStatusDialog;
