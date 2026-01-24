import { useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";

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
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword)
      return false;
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
        toast.error("Vui lòng nhập đúng thông tin mật khẩu.");
        return;
      }

      const res = await api.patch("/auth/change-password", form, {
        withCredentials: true,
      });

      toast.success(
        res?.data?.message ||
          "Đổi mật khẩu thành công! Vui lòng đăng nhập lại.",
      );

      setOpen(false);
      resetForm();

      clearState();
      window.location.href = "/signin";
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          "Đổi mật khẩu thất bại. Vui lòng thử lại!",
      );
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
            Đổi mật khẩu
          </DialogTitle>
          <DialogDescription>
            Nhập mật khẩu hiện tại và mật khẩu mới. Sau khi đổi sẽ cần đăng nhập
            lại.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
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
                placeholder="Nhập mật khẩu hiện tại"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShow((s) => ({ ...s, current: !s.current }))}
              >
                {show.current ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">Mật khẩu mới</Label>
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
                placeholder={`Ít nhất ${MIN_PASSWORD_LEN} ký tự`}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShow((s) => ({ ...s, next: !s.next }))}
              >
                {show.next ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>

            {form.newPassword && form.newPassword.length < MIN_PASSWORD_LEN && (
              <p className="text-xs text-destructive">
                Mật khẩu mới phải có ít nhất {MIN_PASSWORD_LEN} ký tự.
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
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
                placeholder="Nhập lại mật khẩu mới"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
              >
                {show.confirm ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>

            {form.confirmPassword &&
              form.newPassword !== form.confirmPassword && (
                <p className="text-xs text-destructive">
                  Mật khẩu xác nhận không khớp.
                </p>
              )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 glass-light border-border/30"
              onClick={() => handleCloseDialog(false)}
              disabled={loading}
            >
              Huỷ
            </Button>

            <Button
              type="button"
              className="flex-1 bg-gradient-primary hover:opacity-90"
              disabled={!isValid || loading}
              onClick={handleChangePassword}
            >
              {loading ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
