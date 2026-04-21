import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForgotPasswordStore } from "@/stores/useForgotPasswordStore";

const otpSchema = z.object({
  otp: z.string().trim().regex(/^\d{6}$/, "OTP phải gồm đúng 6 chữ số."),
});

type VerifyOtpFormValues = z.infer<typeof otpSchema>;

export const VerifyForgotPasswordOtpForm = () => {
  const {
    email,
    loading,
    errorMessage,
    resendAvailableAt,
    verifyOtp,
    resendOtp,
    goToStep,
  } = useForgotPasswordStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!resendAvailableAt) return 0;
    return Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));
  }, [now, resendAvailableAt]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyOtpFormValues>({
    resolver: zodResolver(otpSchema),
  });

  const onSubmit = async (data: VerifyOtpFormValues) => {
    await verifyOtp(data.otp);
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="forgot-otp">Mã xác nhận</Label>
        <Input
          id="forgot-otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          {...register("otp")}
        />
        {errors.otp ? (
          <p className="text-sm text-destructive">{errors.otp.message}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nhập mã 6 số đã được gửi đến <strong>{email}</strong>.
          </p>
        )}
      </div>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      <Button type="submit" className="w-full" loading={loading || isSubmitting}>
        Xác nhận mã
      </Button>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={loading || secondsLeft > 0}
        onClick={() => void resendOtp()}
      >
        {secondsLeft > 0 ? `Gửi lại mã sau ${secondsLeft}s` : "Gửi lại mã"}
      </Button>

      <Button type="button" variant="ghost" className="w-full" onClick={() => goToStep("email")}>
        Quay lại nhập email
      </Button>
    </form>
  );
};
