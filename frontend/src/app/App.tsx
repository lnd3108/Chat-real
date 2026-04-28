import { BrowserRouter, Route, Routes } from "react-router";
import { SignInPage } from "@/features/auth/pages/SignInPage";
import { SignUpPage } from "@/features/auth/pages/SignUpPasge";
import ChatAppPage from "@/features/chat/pages/ChatAppPage";
import { GoogleAuthCallbackPage } from "@/features/auth/pages/GoogleAuthCallbackPage";
import { VerifyEmailPage } from "@/features/auth/pages/VerifyEmailPage";
import { ForgotPasswordPage } from "@/features/auth/pages/ForgotPasswordPage";
import { Toaster } from "sonner";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import AdminProtectedRoute from "@/features/auth/components/AdminProtectedRoute";
import AdminLayout from "@/features/admin/components/AdminLayout";
import { ADMIN_ROUTES } from "@/features/admin/config/adminRoutes";
import MaintenanceModeModal from "@/app/components/MaintenanceModeModal";
import { useThemeStore } from "@/features/settings/stores/useThemeStore";
import { useEffect } from "react";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import { useSocketStore } from "@/shared/realtime/useSocketStore";
import { requestDesktopNotificationPermission } from "@/features/notification/lib/messageNotifications";
import { installGlobalUiSoundEffects } from "@/features/settings/lib/sound";

function App() {
  const { isDark, setTheme } = useThemeStore();
  const { accessToken } = useAuthStore();
  const { connectSocket, disconnectSocket } = useSocketStore();
  const fetchConversations = useChatStore((state) => state.fetchConversations);

  useEffect(() => {
    setTheme(isDark);
  }, [isDark, setTheme]);

  useEffect(() => {
    if (accessToken) {
      connectSocket();
      void fetchConversations();
      requestDesktopNotificationPermission();
    }

    return () => disconnectSocket();
  }, [accessToken, connectSocket, disconnectSocket, fetchConversations]);

  useEffect(() => installGlobalUiSoundEffects(), []);

  return (
    <>
      <MaintenanceModeModal />
      <Toaster
        theme={isDark ? "dark" : "light"}
        position="bottom-right"
        closeButton
        toastOptions={{
          duration: 4000,
          className:
            "border border-border/70 bg-background text-foreground shadow-xl rounded-2xl",
          descriptionClassName: "text-muted-foreground",
          actionButtonStyle: {
            background: isDark ? "hsl(262 83% 58%)" : "hsl(221 83% 53%)",
            color: "white",
            borderRadius: "10px",
          },
          cancelButtonStyle: {
            borderRadius: "10px",
          },
        }}
      />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route
            path="/signin/oauth2/google"
            element={<GoogleAuthCallbackPage />}
          />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected routes - User */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<ChatAppPage />} />
          </Route>

          {/* Protected routes - Admin */}
          <Route element={<AdminProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={null} />
              {ADMIN_ROUTES.map((route) => (
                <Route
                  key={route.path}
                  path={route.path}
                  element={route.element}
                />
              ))}
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
