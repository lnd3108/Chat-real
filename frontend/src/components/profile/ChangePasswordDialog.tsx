import { useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import api from "@/lib/axios";
import { useAuthStore } from "@/stores/useAuthStore";

type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const MIN_PASSWORD_LEN = 6;

type Props = {
  open: boolean;
  setOpen: (val: boolean) => void;
};

const ChangePasswordDialog = ({ open, setOpen }: Props) => {
  const clearState = useAuthStore((s) => s.clearState);

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<ChangePasswordPayload>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [show, setShow] = useState({
    current: false,
    next: false,
    confirm: false,
  });

  const isValid = useMemo(() => {
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      return false;
    }
    if (form.newPassword.length < MIN_PASSWORD_LEN) return false;
    if (form.newPassword !== form.confirmPassword) return false;
    return true;
  }, [form]);

  const resetForm = () => {
    setForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setShow({
      current: false,
      next: false,
      confirm: false,
    });
  };

  const handleCloseDialog = (val: boolean) => {
    setOpen(val);
    if (!val) resetForm();
  };

  const handleChangePassword = async () => {
    try {
      setLoading(true);

      if (!isValid) {
        toast.error("Vui long nhap dung thong tin mat khau.");
        return;
      }

      const res = await api.patch("/auth/change-password", form, {
        withCredentials: true,
      });

      toast.success(
        res?.data?.message || "Doi mat khau thanh cong! Vui long dang nhap lai.",
      );

      setOpen(false);
      resetForm();

      clearState();
      window.location.href = "/signin";
    } catch (error: unknown) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Doi mat khau that bai. Vui long thu lai!";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleCloseDialog}>
      <DialogContent className="glass-strong border-border/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Doi mat khau
          </DialogTitle>
          <DialogDescription>
            Nhap mat khau hien tai va mat khau moi. Sau khi doi se can dang nhap lai.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Mat khau hien tai</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={show.current ? "text" : "password"}
                value={form.currentPassword}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    currentPassword: e.target.value,
                  }))
                }
                className="glass-light border-border/30 pr-10"
                placeholder="Nhap mat khau hien tai"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShow((s) => ({ ...s, current: !s.current }))}
              >
                {show.current ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Mat khau moi</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={show.next ? "text" : "password"}
                value={form.newPassword}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    newPassword: e.target.value,
                  }))
                }
                className="glass-light border-border/30 pr-10"
                placeholder={`It nhat ${MIN_PASSWORD_LEN} ky tu`}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShow((s) => ({ ...s, next: !s.next }))}
              >
                {show.next ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            {form.newPassword && form.newPassword.length < MIN_PASSWORD_LEN && (
              <p className="text-xs text-destructive">
                Mat khau moi phai co it nhat {MIN_PASSWORD_LEN} ky tu.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Xac nhan mat khau moi</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={show.confirm ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
                className="glass-light border-border/30 pr-10"
                placeholder="Nhap lai mat khau moi"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
              >
                {show.confirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            {form.confirmPassword && form.newPassword !== form.confirmPassword && (
              <p className="text-xs text-destructive">Mat khau xac nhan khong khop.</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="glass-light flex-1 border-border/30"
              onClick={() => handleCloseDialog(false)}
              disabled={loading}
            >
              Huy
            </Button>

            <Button
              type="button"
              className="flex-1 bg-gradient-primary hover:opacity-90"
              disabled={!isValid || loading}
              onClick={handleChangePassword}
            >
              {loading ? "Dang cap nhat..." : "Cap nhat mat khau"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
