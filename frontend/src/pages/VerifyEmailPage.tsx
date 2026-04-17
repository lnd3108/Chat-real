import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuthStore } from "@/stores/useAuthStore";

const verifySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Nhập mã gồm 6 chữ số"),
});

type VerifyFormValues = z.infer<typeof verifySchema>;

export const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const {
    loading,
    verifyPendingEmailCode,
    resendPendingEmailCode,
    clearPendingEmailVerification,
    pendingGoogleVerificationEmail,
    pendingGoogleVerificationToken,
    pendingEmailVerificationPurpose,
    pendingEmailResendAvailableAt,
  } = useAuthStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!pendingGoogleVerificationToken || !pendingEmailVerificationPurpose) {
      navigate("/signin", { replace: true });
    }
  }, [navigate, pendingEmailVerificationPurpose, pendingGoogleVerificationToken]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
  });

  const onSubmit = async (data: VerifyFormValues) => {
    const result = await verifyPendingEmailCode(data.code);

    if (result === "signed_in") {
      navigate("/", { replace: true });
      return;
    }

    if (result === "verified_only") {
      navigate("/signin", { replace: true });
    }
  };

  const secondsLeft = useMemo(() => {
    if (!pendingEmailResendAvailableAt) return 0;
    return Math.max(
      0,
      Math.ceil((pendingEmailResendAvailableAt - now) / 1000),
    );
  }, [now, pendingEmailResendAvailableAt]);
  const canResend = secondsLeft <= 0 && !loading;

  if (!pendingGoogleVerificationToken || !pendingEmailVerificationPurpose) {
    return null;
  }

  const isSignupVerification = pendingEmailVerificationPurpose === "signup";

  return (
    <div className="absolute inset-0 flex min-h-svh items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-md border-border">
        <CardHeader>
          <CardTitle>
            {isSignupVerification ? "Xác minh email đăng ký" : "Xác minh Gmail"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <p className="text-sm text-muted-foreground">
              Hệ thống đã gửi mã xác minh tới{" "}
              <strong>{pendingGoogleVerificationEmail}</strong>.
              {isSignupVerification
                ? " Nhập mã 6 số để kích hoạt tài khoản rồi chuyển sang trang đăng nhập."
                : " Nhập mã 6 số để hoàn tất đăng nhập."}
            </p>

            <div className="space-y-2">
              <Label htmlFor="code">Mã xác minh</Label>
              <Input
                id="code"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                {...register("code")}
              />
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner className="mr-2 size-4" />
                  Đang xác thực...
                </>
              ) : isSignupVerification ? (
                "Xác minh tài khoản"
              ) : (
                "Xác minh và đăng nhập"
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={!canResend}
              onClick={() => void resendPendingEmailCode()}
            >
              {loading ? (
                <>
                  <LoadingSpinner className="mr-2 size-4" />
                  Đang gửi...
                </>
              ) : canResend ? (
                "Gửi lại mã"
              ) : (
                `Gửi lại mã sau ${secondsLeft}s`
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                clearPendingEmailVerification();
                navigate("/signin", { replace: true });
              }}
            >
              Quay lại đăng nhập
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
