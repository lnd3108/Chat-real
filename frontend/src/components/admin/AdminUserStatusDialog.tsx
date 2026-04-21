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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { axiosInstance } from "@/lib/axios";
import { getErrorMessage } from "@/lib/httpError";
import { useAuthStore } from "@/stores/useAuthStore";
import type { AdminUserStatus } from "@/types/admin";

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
          ? "Da khoa tai khoan nguoi dung."
          : "Da mo khoa tai khoan nguoi dung.",
      );
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Khong the cap nhat trang thai tai khoan."));
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
          {isSelf ? "Khong the tu khoa" : isBanned ? "Mo khoa tai khoan" : "Khoa tai khoan"}
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
          <AlertDialogTitle>{isBanned ? "Mo khoa tai khoan" : "Khoa tai khoan"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isBanned
              ? `Tai khoan ${displayName} (@${userName}) se duoc mo khoa va co the dang nhap lai.`
              : `Tai khoan ${displayName} (@${userName}) se bi khoa, khong the dang nhap, refresh token hay tiep tuc su dung app.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Huy</AlertDialogCancel>
          <Button onClick={handleSubmit} disabled={submitting} variant={isBanned ? "default" : "destructive"}>
            {submitting ? "Dang xu ly..." : isBanned ? "Mo khoa" : "Khoa tai khoan"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AdminUserStatusDialog;
