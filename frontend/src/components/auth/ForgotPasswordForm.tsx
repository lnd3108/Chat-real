import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForgotPasswordStore } from "@/stores/useForgotPasswordStore";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Vui lòng nhập email hợp lệ."),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const ForgotPasswordForm = () => {
  const { email, loading, errorMessage, requestOtp } = useForgotPasswordStore();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email,
    },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    await requestOtp(data.email.trim().toLowerCase());
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="forgot-email">Email</Label>
        <Input
          id="forgot-email"
          type="email"
          placeholder="ban@gmail.com"
          autoComplete="email"
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nhập email đã đăng ký bằng mật khẩu. Nếu email hợp lệ trong hệ thống và tài khoản dùng
            đăng nhập local, mã xác nhận sẽ được gửi. Tài khoản đăng nhập bằng Google sẽ không
            nhận mã quên mật khẩu.
          </p>
        )}
      </div>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      <Button type="submit" className="w-full" loading={loading || isSubmitting}>
        Gửi mã xác nhận
      </Button>
    </form>
  );
};
