import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";
import { VerifyForgotPasswordOtpForm } from "@/features/auth/components/VerifyForgotPasswordOtpForm";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";
import { useForgotPasswordStore } from "@/features/auth/stores/useForgotPasswordStore";

const STEP_TITLES = {
  email: "Quên mật khẩu",
  otp: "Nhập mã xác nhận",
  reset: "Đặt mật khẩu mới",
  success: "Đổi mật khẩu thành công",
} as const;

const STEP_DESCRIPTIONS = {
  email: "Nhập email đã đăng ký để nhận mã xác nhận qua Gmail.",
  otp: "Mã xác nhận chỉ có hiệu lực trong vài phút và chỉ dùng được một lần.",
  reset: "Sau khi xác thực OTP thành công, bạn có thể đặt mật khẩu mới.",
  success: "Bạn có thể đăng nhập lại bằng mật khẩu mới.",
} as const;

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { step, successMessage, resetFlow } = useForgotPasswordStore();

  useEffect(() => () => resetFlow(), [resetFlow]);

  const content = useMemo(() => {
    if (step === "otp") return <VerifyForgotPasswordOtpForm />;
    if (step === "reset") return <ResetPasswordForm />;
    if (step === "success") {
      return (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {successMessage || "Đổi mật khẩu thành công. Vui lòng đăng nhập lại."}
          </p>
          <Button className="app-primary-gradient w-full border-0 text-slate-950" onClick={() => navigate("/signin", { replace: true })}>
            Quay về đăng nhập
          </Button>
        </div>
      );
    }

    return <ForgotPasswordForm />;
  }, [navigate, step, successMessage]);

  return (
    <div className="app-shell-bg absolute inset-0 flex min-h-svh items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <Card className="app-glass-card">
          <CardHeader className="space-y-2">
            <CardTitle>{STEP_TITLES[step]}</CardTitle>
            <CardDescription>{STEP_DESCRIPTIONS[step]}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={step === "email" ? "font-semibold text-foreground" : ""}>1. Email</span>
              <span>/</span>
              <span className={step === "otp" ? "font-semibold text-foreground" : ""}>2. OTP</span>
              <span>/</span>
              <span
                className={
                  step === "reset" || step === "success" ? "font-semibold text-foreground" : ""
                }
              >
                3. Mật khẩu mới
              </span>
            </div>

            {content}

            {step !== "success" && (
              <Button variant="ghost" className="w-full" onClick={() => navigate("/signin")}>
                Quay lại đăng nhập
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
