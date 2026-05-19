import { useEffect } from "react";
import { toast } from "sonner";
import { SignInForm } from "@/features/auth/components/signin-form";
import { normalizeToastMessage } from "@/shared/lib/toastMessage";

const AUTH_REDIRECT_TOAST_KEY = "auth_redirect_toast";

export const SignInPage = () => {
  useEffect(() => {
    const rawValue = window.sessionStorage.getItem(AUTH_REDIRECT_TOAST_KEY);
    if (!rawValue) return;

    window.sessionStorage.removeItem(AUTH_REDIRECT_TOAST_KEY);

    try {
      const payload = JSON.parse(rawValue) as {
        type?: "success" | "error";
        message?: string;
      };

      if (!payload?.message) return;

      if (payload.type === "error") {
        toast.error(normalizeToastMessage(payload.message));
        return;
      }

      toast.success(normalizeToastMessage(payload.message));
    } catch {
      toast.success(normalizeToastMessage(rawValue));
    }
  }, []);

  return (
    <div className="app-shell-bg absolute inset-0 z-0 flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <SignInForm />
      </div>
    </div>
  );
};
