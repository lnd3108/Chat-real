import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuthStore } from "@/stores/useAuthStore";

export const GoogleAuthCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeGoogleSignIn } = useAuthStore();

  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      navigate("/signin", { replace: true });
      return;
    }

    const run = async () => {
      const ok = await completeGoogleSignIn(code);
      navigate(ok ? "/" : "/verify-email", { replace: true });
    };

    run();
  }, [completeGoogleSignIn, navigate, searchParams]);

  return (
    <div className="absolute inset-0 flex min-h-svh items-center justify-center bg-muted p-6">
      <div className="flex min-w-80 items-center justify-center gap-3 rounded-2xl border border-border bg-background px-6 py-5 text-center shadow-sm">
        <LoadingSpinner className="size-5 text-primary" />
        <span>Đang xử lý đăng nhập Google...</span>
      </div>
    </div>
  );
};
