import { z } from "zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/useAuthStore";

const verifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Nhập mã gồm 6 chữ số"),
});

type VerifyFormValues = z.infer<typeof verifySchema>;

export const VerifyGoogleEmailPage = () => {
  const navigate = useNavigate();
  const {
    verifyGoogleEmailCode,
    pendingGoogleVerificationEmail,
    pendingGoogleVerificationToken,
  } = useAuthStore();

  useEffect(() => {
    if (!pendingGoogleVerificationToken) {
      navigate("/signin", { replace: true });
    }
  }, [navigate, pendingGoogleVerificationToken]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
  });

  const onSubmit = async (data: VerifyFormValues) => {
    const ok = await verifyGoogleEmailCode(data.code);
    if (ok) {
      navigate("/", { replace: true });
    }
  };

  if (!pendingGoogleVerificationToken) {
    return null;
  }

  return (
    <div className="absolute inset-0 flex min-h-svh items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-md border-border">
        <CardHeader>
          <CardTitle>Xác minh Gmail</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <p className="text-sm text-muted-foreground">
              Hệ thống đã gửi mã xác minh tới <strong>{pendingGoogleVerificationEmail}</strong>.
              Nhập mã 6 số để hoàn tất đăng nhập.
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

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              Xác minh và đăng nhập
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/signin")}
            >
              Quay lại đăng nhập
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
