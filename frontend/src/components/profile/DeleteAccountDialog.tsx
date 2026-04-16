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
        toast.error(`Nhap dung "${DELETE_CONFIRM_WORD}" de xac nhan xoa.`);
        return;
      }

      const res = await api.delete("/auth/delete-account", {
        withCredentials: true,
      });

      toast.success(res?.data?.message || "Xoa tai khoan thanh cong!");

      clearState();
      window.location.href = "/signin";
    } catch (error: unknown) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Xoa tai khoan that bai. Thu lai nhe!";
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
            Xoa tai khoan
          </DialogTitle>
          <DialogDescription>
            Hanh dong nay khong the hoan tac. Toan bo du lieu tai khoan cua ban se bi xoa vinh vien.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          <p className="text-sm text-muted-foreground">
            Nhap <b>{DELETE_CONFIRM_WORD}</b> de xac nhan.
          </p>

          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="glass-light border-border/30"
            placeholder={`Go ${DELETE_CONFIRM_WORD} de xoa`}
          />

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="glass-light flex-1 border-border/30"
              onClick={closeDialog}
              disabled={deleteLoading}
            >
              Huy
            </Button>

            <Button
              variant="destructive"
              className="flex-1"
              disabled={!canDelete || deleteLoading}
              onClick={handleDeleteAccount}
            >
              {deleteLoading ? "Dang xoa..." : "Xoa vinh vien"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteAccountDialog;
