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
import { useAuthStore } from "@/stores/useAuthStore";

interface AdminDeleteUserDialogProps {
  userId: string;
  userName: string;
  displayName: string;
  fullWidth?: boolean;
}

const AdminDeleteUserDialog = ({
  userId,
  userName,
  displayName,
  fullWidth = false,
}: AdminDeleteUserDialogProps) => {
  const navigate = useNavigate();
  const currentAdminId = useAuthStore((state) => state.user?._id);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState("");

  const isSelf = currentAdminId === userId;

  const handleDelete = async () => {
    if (isSelf) return;

    try {
      setSubmitting(true);

      await axiosInstance.delete(`/admin/users/${userId}`, {
        data: {
          reason: reason.trim() || undefined,
        },
      });

      toast.success("Đã xóa tài khoản người dùng.");
      setOpen(false);
      navigate("/admin/users", { replace: true });
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Không thể xóa tài khoản.");
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
          {isSelf ? "Không thể tự xóa" : "Xóa tài khoản"}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="sm:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Xóa tài khoản người dùng</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-left">
            <p>
              Bạn sắp xóa vĩnh viễn tài khoản <strong>{displayName}</strong> (@{userName}).
            </p>
            <p>Quy tắc áp dụng:</p>
            <p>- Direct chat sẽ bị xóa sạch cùng toàn bộ direct messages.</p>
            <p>
              - Group chat sẽ không bị xóa chỉ vì user này, nhưng user sẽ bị remove khỏi nhóm.
            </p>
            <p>
              - Group messages cũ vẫn được giữ lại, sender sẽ được ẩn danh thành
              {" "}
              <strong>“Người dùng đã xóa”</strong>.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="admin-delete-reason">
            Lý do xóa
          </label>
          <Input
            id="admin-delete-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Vi phạm chính sách"
            maxLength={300}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Hủy</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={submitting}
            onClick={handleDelete}
          >
            {submitting ? "Đang xóa..." : "Xác nhận xóa tài khoản"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AdminDeleteUserDialog;
