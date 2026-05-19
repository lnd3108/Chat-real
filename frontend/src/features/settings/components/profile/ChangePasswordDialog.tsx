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
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";

import api from "@/shared/api/axios";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";

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

type ChangePasswordFormProps = {
  onCancel?: () => void;
  onSuccess?: () => void;
};

export const ChangePasswordForm = ({ onCancel, onSuccess }: ChangePasswordFormProps) => {
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
        res?.data?.message || "Đổi mật khẩu thành công! Vui lòng đăng nhập lại.",
      );

      resetForm();
      onSuccess?.();
      clearState();
      window.location.href = "/signin";
    } catch (error: unknown) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Đổi mật khẩu thất bại. Vui lòng thử lại!";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
        <PasswordInput
          id="currentPassword"
          value={form.currentPassword}
          visible={show.current}
          placeholder="Nhập mật khẩu hiện tại"
          onToggle={() => setShow((s) => ({ ...s, current: !s.current }))}
          onChange={(value) =>
            setForm((prev) => ({
              ...prev,
              currentPassword: value,
            }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">Mật khẩu mới</Label>
        <PasswordInput
          id="newPassword"
          value={form.newPassword}
          visible={show.next}
          placeholder={`Ít nhất ${MIN_PASSWORD_LEN} ký tự`}
          onToggle={() => setShow((s) => ({ ...s, next: !s.next }))}
          onChange={(value) =>
            setForm((prev) => ({
              ...prev,
              newPassword: value,
            }))
          }
        />
        {form.newPassword && form.newPassword.length < MIN_PASSWORD_LEN ? (
          <p className="text-xs text-destructive">
            Mật khẩu mới phải có ít nhất {MIN_PASSWORD_LEN} ký tự.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
        <PasswordInput
          id="confirmPassword"
          value={form.confirmPassword}
          visible={show.confirm}
          placeholder="Nhập lại mật khẩu mới"
          onToggle={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
          onChange={(value) =>
            setForm((prev) => ({
              ...prev,
              confirmPassword: value,
            }))
          }
        />
        {form.confirmPassword && form.newPassword !== form.confirmPassword ? (
          <p className="text-xs text-destructive">
            Mật khẩu xác nhận không khớp.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="glass-light flex-1 border-border/30"
          onClick={() => {
            resetForm();
            onCancel?.();
          }}
          disabled={loading}
        >
          Hủy
        </Button>

        <Button
          type="button"
          className="app-primary-gradient flex-1 border-0 text-slate-950 hover:opacity-90"
          disabled={!isValid || loading}
          onClick={handleChangePassword}
          loading={loading}
          loadingText="Đang cập nhật..."
        >
          Cập nhật mật khẩu
        </Button>
      </div>
    </div>
  );
};

type PasswordInputProps = {
  id: string;
  value: string;
  visible: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onToggle: () => void;
};

const PasswordInput = ({
  id,
  value,
  visible,
  placeholder,
  onChange,
  onToggle,
}: PasswordInputProps) => (
  <div className="relative">
    <Input
      id={id}
      type={visible ? "text" : "password"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="glass-light border-border/30 pr-10"
      placeholder={placeholder}
    />
    <button
      type="button"
      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      onClick={onToggle}
      aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
    >
      {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  </div>
);

const ChangePasswordDialog = ({ open, setOpen }: Props) => (
  <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="glass-strong border-border/30">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          Đổi mật khẩu
        </DialogTitle>
        <DialogDescription>
          Nhập mật khẩu hiện tại và mật khẩu mới. Sau khi đổi sẽ cần đăng nhập lại.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-2">
        <ChangePasswordForm
          onCancel={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      </div>
    </DialogContent>
  </Dialog>
);

export default ChangePasswordDialog;
