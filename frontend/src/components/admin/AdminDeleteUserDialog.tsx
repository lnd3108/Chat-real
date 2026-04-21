import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
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
import { Input } from "@/components/ui/input";
import { axiosInstance } from "@/lib/axios";
import { getErrorMessage } from "@/lib/httpError";
import { useAuthStore } from "@/stores/useAuthStore";

interface AdminDeleteUserDialogProps {
  userId: string;
  userName: string;
  displayName: string;
  fullWidth?: boolean;
  redirectToUsers?: boolean;
  onSuccess?: () => void;
}

const AdminDeleteUserDialog = ({
  userId,
  userName,
  displayName,
  fullWidth = false,
  redirectToUsers = true,
  onSuccess,
}: AdminDeleteUserDialogProps) => {
  const navigate = useNavigate();
  const currentAdminId = useAuthStore((state) => state.user?._id);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState("");

  const isSelf = currentAdminId === userId;

  const handleDelete = async () => {
    if (isSelf) {
      return;
    }

    try {
      setSubmitting(true);

      await axiosInstance.delete(`/admin/users/${userId}`, {
        data: {
          reason: reason.trim() || undefined,
        },
      });

      toast.success("Da xoa tai khoan nguoi dung.");
      setOpen(false);
      onSuccess?.();

      if (redirectToUsers) {
        navigate("/admin/users", { replace: true });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Khong the xoa tai khoan."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          disabled={isSelf}
          className={fullWidth ? "w-full justify-start" : ""}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {isSelf ? "Khong the tu xoa" : "Xoa tai khoan"}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="sm:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Xoa tai khoan nguoi dung</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-left">
            <p>
              Ban sap xoa vinh vien tai khoan <strong>{displayName}</strong> (@{userName}).
            </p>
            <p>Quy tac ap dung:</p>
            <p>- Direct chat se bi xoa sach cung toan bo direct messages.</p>
            <p>- Group chat khong bi xoa chi vi user nay, nhung user se bi remove khoi nhom.</p>
            <p>
              - Group messages cũ vẫn được giữ lại, sender sẽ được ẩn danh thành <strong>"Người dùng đã xóa"</strong>.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="admin-delete-reason">
            Ly do xoa
          </label>
          <Input
            id="admin-delete-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Vi du: Vi pham chinh sach"
            maxLength={300}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Hủy</AlertDialogCancel>
          <Button variant="destructive" disabled={submitting} onClick={handleDelete}>
            {submitting ? "Dang xoa..." : "Xac nhan xoa tai khoan"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AdminDeleteUserDialog;
