import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuthStore } from "@/stores/useAuthStore";
import { MessageCircleMore } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router";

const ProtectedRoute = () => {
  const { accessToken, loading, refresh, fetchMe, user } = useAuthStore();
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        let token = useAuthStore.getState().accessToken;
        let currentUser = useAuthStore.getState().user;

        if (!token) {
          await refresh();
          token = useAuthStore.getState().accessToken;
          currentUser = useAuthStore.getState().user;
        }

        if (token && !currentUser) {
          await fetchMe();
        }
      } finally {
        if (!cancelled) {
          setStarting(false);
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [refresh, fetchMe]);

  if (starting || loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(97,218,251,0.16),_transparent_35%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--background))_100%)] px-6">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute left-[30%] top-[35%] size-40 rounded-full bg-cyan-400/10 blur-3xl" />
        </div>

        <div className="relative w-full max-w-md rounded-3xl border border-border/50 bg-card/75 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-gradient-chat text-white shadow-lg">
            <MessageCircleMore className="size-8" />
          </div>

          <div className="mx-auto mb-4 flex items-center justify-center">
            <div className="flex size-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
              <LoadingSpinner className="size-7 text-primary" />
            </div>
          </div>

          <h2 className="text-xl font-semibold text-foreground">Đang tải ứng dụng</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Hệ thống đang kiểm tra phiên đăng nhập và đồng bộ dữ liệu của bạn.
          </p>

          <div className="mt-6 overflow-hidden rounded-full bg-muted/70">
            <div className="h-1.5 w-full animate-pulse rounded-full bg-gradient-chat" />
          </div>
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/signin" replace />;
  }

  if (user?.role === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
