import { useAuthStore } from "@/stores/useAuthStore";
import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router";

const ProtectedRoute = () => {
  const { accessToken, loading, refresh, fetchMe } = useAuthStore();
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
      <div className="flex h-screen items-center justify-center">
        Dang tai trang...
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/signin" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
