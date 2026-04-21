import { useEffect, useState } from "react";
import { AlertTriangle, Copy, Eye, EyeOff, Lock, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { maintenanceService } from "@/services/maintenanceService";
import { cn } from "@/lib/utils";
import { useAdminDashboardStore } from "@/stores/useAdminDashboardStore";

interface MaintenanceStatus {
  isEnabled: boolean;
  message: string;
  enabledAt: string | null;
  enabledBy: string | null;
  disabledAt: string | null;
  disabledBy: string | null;
}

type Step = "idle" | "password" | "code" | "message";

const AdminMaintenance = () => {
  const dashboardOverview = useAdminDashboardStore((state) => state.overview);
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("idle");

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [codeAttempts, setCodeAttempts] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(5);

  const [newMessage, setNewMessage] = useState("");
  const [messageLoading, setMessageLoading] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);

  // true = bật bảo trì, false = tắt bảo trì, null = chưa xác định
  const [toggleTarget, setToggleTarget] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const data = await maintenanceService.getStatus();
        setStatus(data);
        setNewMessage(data.message);
      } catch (error) {
        console.error("Không thể lấy trạng thái bảo trì:", error);
        toast.error("Không thể tải trạng thái bảo trì");
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  useEffect(() => {
    if (!dashboardOverview?.maintenance) {
      return;
    }

    setStatus((prev) =>
      prev
        ? {
            ...prev,
            isEnabled: dashboardOverview.maintenance?.isEnabled ?? prev.isEnabled,
            message: dashboardOverview.maintenance?.message ?? prev.message,
            enabledAt: dashboardOverview.maintenance?.enabledAt ?? prev.enabledAt,
            disabledAt: dashboardOverview.maintenance?.disabledAt ?? prev.disabledAt,
          }
        : prev,
    );
  }, [dashboardOverview]);

  const handleVerifyPassword = async () => {
    if (!password.trim()) {
      setPasswordError("Vui lòng nhập mật khẩu");
      return;
    }

    try {
      setPasswordLoading(true);
      setPasswordError("");

      await maintenanceService.verifyPassword(password);

      toast.success("Mã xác nhận đã được gửi tới email của bạn");
      setPassword("");
      setStep("code");
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Xác minh mật khẩu thất bại";
      setPasswordError(message);
      toast.error(message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleConfirmToggle = async () => {
    if (!code.trim()) {
      setCodeError("Vui lòng nhập mã xác nhận");
      return;
    }

    if (code.trim().length !== 6) {
      setCodeError("Mã xác nhận phải gồm 6 chữ số");
      return;
    }

    if (toggleTarget === null) {
      setCodeError("Chế độ cần thiết chưa được xác định");
      return;
    }

    try {
      setCodeLoading(true);
      setCodeError("");

      const result = await maintenanceService.confirmToggle(
        code.trim(),
        toggleTarget,
      );

      setStatus((prev) =>
        prev
          ? {
              ...prev,
              isEnabled: result.isEnabled,
              enabledAt: result.enabledAt,
              disabledAt: result.disabledAt,
            }
          : null,
      );

      toast.success(result.message);

      setCode("");
      setStep("idle");
      setToggleTarget(null);
      setCodeAttempts(0);
    } catch (error: any) {
      const errData = error.response?.data;
      const message = errData?.message || "Xác nhận mã thất bại";

      setCodeError(message);

      if (errData?.attempts !== undefined) {
        setCodeAttempts(errData.attempts);
        setMaxAttempts(errData.maxAttempts || 5);
      }

      toast.error(message);
    } finally {
      setCodeLoading(false);
    }
  };

  const handleUpdateMessage = async () => {
    if (!newMessage.trim()) {
      toast.error("Vui lòng nhập tin nhắn bảo trì");
      return;
    }

    try {
      setMessageLoading(true);

      await maintenanceService.updateMessage(newMessage.trim());

      setStatus((prev) =>
        prev
          ? {
              ...prev,
              message: newMessage.trim(),
            }
          : null,
      );

      toast.success("Tin nhắn bảo trì đã được cập nhật");
      setShowMessageForm(false);
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Cập nhật tin nhắn thất bại";
      toast.error(message);
    } finally {
      setMessageLoading(false);
    }
  };

  const handleStartToggle = (enable: boolean) => {
    setToggleTarget(enable);
    setStep("password");

    setPassword("");
    setCode("");
    setPasswordError("");
    setCodeError("");
    setCodeAttempts(0);
  };

  const handleCancel = () => {
    setStep("idle");
    setPassword("");
    setCode("");
    setPasswordError("");
    setCodeError("");
    setToggleTarget(null);
    setCodeAttempts(0);
  };

  const toggleActionText =
    toggleTarget === true ? "Bật" : toggleTarget === false ? "Tắt" : "";

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40" />
        <Skeleton className="h-32" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6">
        <h2 className="text-lg font-semibold text-destructive">Lỗi</h2>
        <p className="mt-2 text-sm">Không thể tải thông tin bảo trì hệ thống</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Zap className="h-8 w-8 text-amber-500" />
          Chế độ Bảo Trì
        </h1>
        <p className="mt-2 text-muted-foreground">
          Quản lý trạng thái bảo trì hệ thống
        </p>
      </div>

      <div
        className={cn(
          "rounded-lg border p-6 transition-colors",
          status.isEnabled
            ? "border-amber-500/50 bg-amber-500/10"
            : "border-emerald-500/50 bg-emerald-500/10",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold">
              Trạng thái:{" "}
              {status.isEnabled ? "🔴 ĐANG BẢO TRÌ" : "🟢 HOẠT ĐỘNG"}
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Hệ thống hiện đang{" "}
              <span className="font-semibold">
                {status.isEnabled
                  ? "tạm dừng dịch vụ"
                  : "hoạt động bình thường"}
              </span>
            </p>

            {status.enabledAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Bật lúc: {new Date(status.enabledAt).toLocaleString("vi-VN")}
              </p>
            )}

            {status.disabledAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Tắt lúc: {new Date(status.disabledAt).toLocaleString("vi-VN")}
              </p>
            )}
          </div>

          <Button
            onClick={() => handleStartToggle(!status.isEnabled)}
            disabled={step !== "idle"}
            variant={status.isEnabled ? "destructive" : "default"}
            size="lg"
            className="gap-2"
          >
            <Lock className="h-4 w-4" />
            {status.isEnabled ? "Tắt Bảo Trì" : "Bật Bảo Trì"}
          </Button>
        </div>
      </div>

      {step === "password" && (
        <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-6">
          <h3 className="font-semibold">Bước 1: Xác Minh Mật Khẩu</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Nhập mật khẩu admin của bạn để tiếp tục{" "}
            {toggleTarget !== null && (
              <span className="font-medium">
                thao tác {toggleActionText.toLowerCase()} bảo trì
              </span>
            )}
          </p>

          <div className="mt-4 space-y-3">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !passwordLoading) {
                    handleVerifyPassword();
                  }
                }}
                disabled={passwordLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {passwordError && (
              <p className="text-sm text-red-500">{passwordError}</p>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleVerifyPassword}
                disabled={!password.trim() || passwordLoading}
                loading={passwordLoading}
              >
                Xác Minh
              </Button>

              <Button
                onClick={handleCancel}
                disabled={passwordLoading}
                variant="outline"
              >
                Hủy
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === "code" && (
        <div className="rounded-lg border border-purple-500/50 bg-purple-500/10 p-6">
          <h3 className="font-semibold">Bước 2: Nhập Mã Xác Nhận</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Kiểm tra email của bạn và nhập mã 6 chữ số để{" "}
            <span className="font-medium">
              {toggleTarget === true ? "bật" : "tắt"} bảo trì
            </span>
          </p>

          <div className="mt-4 space-y-3">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setCodeError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !codeLoading) {
                  handleConfirmToggle();
                }
              }}
              disabled={codeLoading}
              maxLength={6}
              className="text-center text-2xl tracking-widest"
            />

            {codeError && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  {codeError}
                  {codeAttempts > 0 ? ` (${codeAttempts}/${maxAttempts})` : ""}
                </span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleConfirmToggle}
                disabled={code.length !== 6 || codeLoading}
                loading={codeLoading}
              >
                Xác Nhận & {toggleTarget === true ? "Bật" : "Tắt"} Bảo Trì
              </Button>

              <Button
                onClick={handleCancel}
                disabled={codeLoading}
                variant="outline"
              >
                Hủy
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border/50 bg-card/50 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold">Tin Nhắn Bảo Trì</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Thông báo sẽ được hiển thị cho người dùng khi hệ thống bảo trì
            </p>
          </div>

          {!showMessageForm && (
            <Button
              onClick={() => setShowMessageForm(true)}
              variant="outline"
              size="sm"
            >
              Chỉnh Sửa
            </Button>
          )}
        </div>

        {!showMessageForm ? (
          <div className="mt-4 rounded-lg bg-muted/30 p-4">
            <p className="text-sm leading-relaxed">{status.message}</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={messageLoading}
              rows={4}
              className="w-full rounded-lg border border-border/50 bg-background p-3 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
              placeholder="Nhập tin nhắn bảo trì..."
            />

            <div className="flex gap-2">
              <Button
                onClick={handleUpdateMessage}
                disabled={!newMessage.trim() || messageLoading}
                loading={messageLoading}
              >
                Lưu Thay Đổi
              </Button>

              <Button
                onClick={() => {
                  setShowMessageForm(false);
                  setNewMessage(status.message);
                }}
                disabled={messageLoading}
                variant="outline"
              >
                Hủy
              </Button>
            </div>
          </div>
        )}
      </div>

      {status.message && !showMessageForm && (
        <div className="rounded-lg border border-border/50 bg-card/30 p-4">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(status.message);
              toast.success("Đã sao chép vào clipboard");
            }}
            className="flex w-full items-center justify-between gap-2 rounded-lg p-3 transition-colors hover:bg-muted/50"
          >
            <span className="flex items-center gap-2 text-sm">
              <Copy className="h-4 w-4" />
              Sao chép tin nhắn
            </span>
            <span className="text-xs text-muted-foreground">
              Click để sao chép
            </span>
          </button>
        </div>
      )}

      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
        <h4 className="font-semibold text-sm">Hướng dẫn:</h4>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>✓ Bạn cần xác minh mật khẩu admin trước</li>
          <li>✓ Mã xác nhận sẽ được gửi tới email admin</li>
          <li>✓ Mã có hiệu lực trong 10 phút</li>
          <li>✓ Khi bật bảo trì, tất cả người dùng sẽ bị ngắt kết nối</li>
          <li>✓ Dashboard admin vẫn hoạt động bình thường</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminMaintenance;
