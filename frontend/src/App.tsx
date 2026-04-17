import { BrowserRouter, Route, Routes } from "react-router";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPasge";
import ChatAppPage from "./pages/ChatAppPage";
import { GoogleAuthCallbackPage } from "./pages/GoogleAuthCallbackPage";
import { VerifyGoogleEmailPage } from "./pages/VerifyGoogleEmailPage";
import { Toaster } from "sonner";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { useThemeStore } from "./stores/useThemeStore";
import { useEffect } from "react";
import { useAuthStore } from "./stores/useAuthStore";
import { useSocketStore } from "./stores/useSocketStore";
import { requestDesktopNotificationPermission } from "./lib/messageNotifications";

function App() {
  const { isDark, setTheme } = useThemeStore();
  const { accessToken } = useAuthStore();
  const { connectSocket, disconnectSocket } = useSocketStore();

  useEffect(() => {
    setTheme(isDark);
  }, [isDark, setTheme]);

  useEffect(() => {
    if (accessToken) {
      connectSocket();
      requestDesktopNotificationPermission();
    }

    return () => disconnectSocket();
  }, [accessToken, connectSocket, disconnectSocket]);

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
          <Route
            path="/verify-google-email"
            element={<VerifyGoogleEmailPage />}
          />

          {/* protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<ChatAppPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
