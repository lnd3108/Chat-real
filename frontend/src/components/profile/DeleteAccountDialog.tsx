import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import api from "@/lib/axios";
import { useAuthStore } from "@/stores/useAuthStore";

type Props = {
  open: boolean;
  setOpen: (val: boolean) => void;
};

const DELETE_CONFIRM_WORD = "DELETE";

const DeleteAccountDialog = ({ open, setOpen }: Props) => {
  const clearState = useAuthStore((s) => s.clearState);

  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const canDelete = useMemo(
    () => confirmText.trim().toUpperCase() === DELETE_CONFIRM_WORD,
    [confirmText],
  );

  const closeDialog = () => {
    setOpen(false);
    setConfirmText("");
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleteLoading(true);

      if (!canDelete) {
        toast.error(`Nhập đúng "${DELETE_CONFIRM_WORD}" để xác nhận xóa.`);
        return;
      }

      const res = await api.delete("/auth/delete-account", {
        withCredentials: true,
      });

      toast.success(res?.data?.message || "Xóa tài khoản thành công!");

      clearState();
      window.location.href = "/signin";
    } catch (error: unknown) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Xóa tài khoản thất bại. Thử lại nhé!";
      toast.error(message);
    } finally {
      setDeleteLoading(false);
      closeDialog();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="glass-strong border-border/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Xóa tài khoản
          </DialogTitle>
          <DialogDescription>
            Hành động này không thể hoàn tác. Toàn bộ dữ liệu tài khoản của bạn
            sẽ bị xóa vĩnh viễn.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          <p className="text-sm text-muted-foreground">
            Nhập <b>{DELETE_CONFIRM_WORD}</b> để xác nhận.
          </p>

          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="glass-light border-border/30"
            placeholder={`Go ${DELETE_CONFIRM_WORD} to confirm`}
          />

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="glass-light flex-1 border-border/30"
              onClick={closeDialog}
              disabled={deleteLoading}
            >
              Hủy
            </Button>

            <Button
              variant="destructive"
              className="flex-1"
              disabled={!canDelete || deleteLoading}
              onClick={handleDeleteAccount}
            >
              {deleteLoading ? "Đang xóa..." : "Xóa vĩnh viễn"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteAccountDialog;
