import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPasge";
import ChatAppPage from "./pages/ChatAppPage";
import { GoogleAuthCallbackPage } from "./pages/GoogleAuthCallbackPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { Toaster } from "sonner";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminProtectedRoute from "./components/auth/AdminProtectedRoute";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminBlocks from "./pages/admin/AdminBlocks";
import AdminFriends from "./pages/admin/AdminFriends";
import AdminFriendRequests from "./pages/admin/AdminFriendRequests";
import AdminConversations from "./pages/admin/AdminConversations";
import AdminReports from "./pages/admin/AdminReports";
import AdminReportDetail from "./pages/admin/AdminReportDetail";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminSupportDetail from "./pages/admin/AdminSupportDetail";
import { useThemeStore } from "./stores/useThemeStore";
import { useEffect } from "react";
import { useAuthStore } from "./stores/useAuthStore";
import { useChatStore } from "./stores/useChatStore";
import { useSocketStore } from "./stores/useSocketStore";
import { requestDesktopNotificationPermission } from "./lib/messageNotifications";
import { installGlobalUiSoundEffects } from "./lib/sound";

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

          {/* Protected routes - User */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<ChatAppPage />} />
          </Route>

          {/* Protected routes - Admin */}
          <Route element={<AdminProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route
                path="/admin"
                element={<Navigate to="/admin/dashboard" replace />}
              />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/users/:id" element={<AdminUserDetail />} />
              <Route path="/admin/blocks" element={<AdminBlocks />} />
              <Route path="/admin/friends" element={<AdminFriends />} />
              <Route
                path="/admin/friend-requests"
                element={<AdminFriendRequests />}
              />
              <Route
                path="/admin/conversations"
                element={<AdminConversations />}
              />
              <Route path="/admin/support" element={<AdminSupport />} />
              <Route
                path="/admin/support/:id"
                element={<AdminSupportDetail />}
              />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route
                path="/admin/reports/:id"
                element={<AdminReportDetail />}
              />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
