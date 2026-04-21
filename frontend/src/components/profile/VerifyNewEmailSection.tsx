import { useEffect, useMemo, useState } from "react";
import { MailCheck, RotateCw, ShieldCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useProfileSettingsStore } from "@/stores/useProfileSettingsStore";

const VerifyNewEmailSection = () => {
  const {
    pendingEmail,
    otp,
    resendAvailableAt,
    isSendingOtp,
    isVerifyingOtp,
    isCancellingPending,
    errorMessage,
    successMessage,
    setOtp,
    resendOtp,
    verifyOtpAndCommit,
    backToEdit,
  } = useProfileSettingsStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!resendAvailableAt) return 0;
    return Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));
  }, [now, resendAvailableAt]);

  const handleResendOtp = async () => {
    const result = await resendOtp();
    if (result.ok) {
      toast.success(result.message);
      return;
    }

    toast.error(result.message);
  };

  const handleVerify = async () => {
    const result = await verifyOtpAndCommit();
    if (result.ok) {
      toast.success(result.message);
      return;
    }

    toast.error(result.message);
  };

  const handleBack = async () => {
    const result = await backToEdit();
    if (!result.ok) {
      toast.error(result.message);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <MailCheck className="size-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold">Xác minh email mới</h3>
          <p className="break-words text-sm leading-6 text-muted-foreground">
            Mã xác minh đã được gửi tới <strong>{pendingEmail}</strong>. Chỉ sau khi xác minh đúng,
            email mới và các thay đổi khác mới được lưu.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email-change-otp">Mã xác minh 6 số</Label>
        <Input
          id="email-change-otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(event) => setOtp(event.target.value)}
          placeholder="123456"
          className="glass-light border-border/30"
        />
      </div>

      {successMessage ? <div className="text-sm text-muted-foreground">{successMessage}</div> : null}
      {errorMessage ? <div className="text-sm text-destructive">{errorMessage}</div> : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Button
          type="button"
          className="w-full bg-gradient-primary"
          onClick={() => void handleVerify()}
          loading={isVerifyingOtp}
          loadingText="Đang xác minh..."
          disabled={otp.trim().length !== 6 || isSendingOtp || isCancellingPending}
        >
          <ShieldCheck className="size-4" />
          Xác minh và lưu
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => void handleResendOtp()}
          disabled={isSendingOtp || isVerifyingOtp || isCancellingPending || secondsLeft > 0}
          loading={isSendingOtp}
          loadingText="Đang gửi lại..."
        >
          <RotateCw className="size-4" />
          {secondsLeft > 0 ? `Gửi lại mã sau ${secondsLeft}s` : "Gửi lại mã"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => void handleBack()}
          disabled={isSendingOtp || isVerifyingOtp || isCancellingPending}
          loading={isCancellingPending}
          loadingText="Đang quay lại..."
        >
          <Undo2 className="size-4" />
          Quay lại chỉnh sửa
        </Button>
      </div>
    </div>
  );
};

export default VerifyNewEmailSection;
