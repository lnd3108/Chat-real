import { useMemo, useState } from "react";
import { Shield, Bell, ShieldBan, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import api from "@/lib/axios";
import { useAuthStore } from "@/stores/useAuthStore";

type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const MIN_PASSWORD_LEN = 6;

const PrivacySettings = () => {
  const clearState = useAuthStore((s) => s.clearState);

  const [openChangePass, setOpenChangePass] = useState(false);
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
    setOpenChangePass(val);
    if (!val) resetForm();
  };

  const handleChangePassword = async () => {
    try {
      setLoading(true);

      // validate FE
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

      // đóng dialog
      setOpenChangePass(false);
      resetForm();

      // clear client state để bắt login lại
      clearState();

      // Redirect về trang login (mày sửa path nếu route khác)
      window.location.href = "/signin";
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        "Đổi mật khẩu thất bại. Vui lòng thử lại!";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="glass-strong border-border/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Quyền riêng tư & Bảo mật
          </CardTitle>
          <CardDescription>
            Quản lý cài đặt quyền riêng tư và bảo mật của bạn
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            {/* Change password */}
            <Button
              variant="outline"
              className="w-full justify-start glass-light border-border/30 hover:text-warning"
              onClick={() => setOpenChangePass(true)}
            >
              <KeyRound className="h-4 w-4 mr-2" />
              Đổi mật khẩu
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start glass-light border-border/30 hover:text-info"
            >
              <Bell className="h-4 w-4 mr-2" />
              Cài đặt thông báo
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start glass-light border-border/30 hover:text-destructive"
            >
              <ShieldBan className="size-4 mr-2" />
              Chặn & Báo cáo
            </Button>
          </div>

          <div className="pt-4 border-t border-border/30">
            <h4 className="font-medium mb-3 text-destructive">
              Khu vực nguy hiểm
            </h4>
            <Button variant="destructive" className="w-full">
              Xoá tài khoản
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Change Password */}
      <Dialog open={openChangePass} onOpenChange={handleCloseDialog}>
        <DialogContent className="glass-strong border-border/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Đổi mật khẩu
            </DialogTitle>
            <DialogDescription>
              Nhập mật khẩu hiện tại và mật khẩu mới. Sau khi đổi sẽ cần đăng
              nhập lại.
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
                  onClick={() =>
                    setShow((s) => ({ ...s, current: !s.current }))
                  }
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

              {form.newPassword &&
                form.newPassword.length < MIN_PASSWORD_LEN && (
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
                  onClick={() =>
                    setShow((s) => ({ ...s, confirm: !s.confirm }))
                  }
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
    </>
  );
};

export default PrivacySettings;
