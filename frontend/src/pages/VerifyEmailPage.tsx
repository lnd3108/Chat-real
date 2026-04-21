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
  code: z.string().trim().regex(/^\d{6}$/, "Nhap ma gom 6 chu so"),
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
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!pendingGoogleVerificationToken || !pendingEmailVerificationPurpose) {
      navigate("/signin", { replace: true });
    }
  }, [navigate, pendingEmailVerificationPurpose, pendingGoogleVerificationToken]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initTimer = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(timer);
    };
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
    if (!pendingEmailResendAvailableAt) {
      return 0;
    }

    return Math.max(0, Math.ceil((pendingEmailResendAvailableAt - now) / 1000));
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
            {isSignupVerification ? "Xac minh email dang ky" : "Xac minh Gmail"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <p className="text-sm text-muted-foreground">
              He thong da gui ma xac minh toi <strong>{pendingGoogleVerificationEmail}</strong>.
              {isSignupVerification
                ? " Nhap ma 6 so de kich hoat tai khoan roi chuyen sang trang dang nhap."
                : " Nhap ma 6 so de hoan tat dang nhap."}
            </p>

            <div className="space-y-2">
              <Label htmlFor="code">Ma xac minh</Label>
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

            <Button type="submit" className="w-full" disabled={isSubmitting || loading}>
              {loading ? (
                <>
                  <LoadingSpinner className="mr-2 size-4" />
                  Dang xac thuc...
                </>
              ) : isSignupVerification ? (
                "Xac minh tai khoan"
              ) : (
                "Xac minh va dang nhap"
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
                  Dang gui...
                </>
              ) : canResend ? (
                "Gui lai ma"
              ) : (
                `Gui lai ma sau ${secondsLeft}s`
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
              Quay lai dang nhap
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
