import { create } from "zustand";
import { toast } from "sonner";
import { persist } from "zustand/middleware";
import axios from "axios";
import { authService } from "@/services/authService";
import type { AuthState } from "@/types/store";
import { normalizeToastMessage } from "@/lib/toastMessage";
import { useChatStore } from "./useChatStore";
import { useFriendStore } from "./useFriendStore";
import { useNotificationStore } from "./useNotificationStore";
import { useSuggestionStore } from "./useSuggestionStore";
import { logger } from "@/lib/logger";

const getAxiosMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return normalizeToastMessage(message);
    }
  }

  return fallback;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      loading: false,
      pendingGoogleVerificationToken: null,
      pendingGoogleVerificationEmail: null,
      pendingEmailVerificationPurpose: null,
      pendingEmailResendAvailableAt: null,

      setAccessToken: (accessToken) => {
        set({ accessToken });
      },

      setUser: (user) => {
        set({ user });
      },

      setPendingGoogleVerification: (
        verificationToken,
        email,
        purpose = null,
        resendAvailableAt = null,
      ) => {
        set({
          pendingGoogleVerificationToken: verificationToken,
          pendingGoogleVerificationEmail: email,
          pendingEmailVerificationPurpose: purpose,
          pendingEmailResendAvailableAt: resendAvailableAt,
        });
      },

      clearPendingEmailVerification: () => {
        set({
          pendingGoogleVerificationToken: null,
          pendingGoogleVerificationEmail: null,
          pendingEmailVerificationPurpose: null,
          pendingEmailResendAvailableAt: null,
        });
      },

      clearState: () => {
        set({
          accessToken: null,
          user: null,
          loading: false,
          pendingGoogleVerificationToken: null,
          pendingGoogleVerificationEmail: null,
          pendingEmailVerificationPurpose: null,
          pendingEmailResendAvailableAt: null,
        });
        useChatStore.getState().reset();
        useFriendStore.getState().reset();
        useNotificationStore.getState().clearAllNotifications();
        useSuggestionStore.getState().resetSuggestions();
        localStorage.removeItem("auth-storage");
        localStorage.removeItem("chat-storage");
        localStorage.removeItem("notification-storage");

        for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
          const key = sessionStorage.key(i);
          if (key?.startsWith("chat-scroll-")) {
            sessionStorage.removeItem(key);
          }
        }
      },

      signUp: async (userName, password, email, firstName, lastName) => {
        try {
          set({ loading: true });
          const result = await authService.signUp(
            userName,
            password,
            email,
            firstName,
            lastName,
          );

          if ("requiresEmailVerification" in result) {
            get().setPendingGoogleVerification(
              result.verificationToken,
              result.email,
              result.purpose,
              result.resendAvailableAt,
            );
            toast.success(normalizeToastMessage(result.message));
            return true;
          }

          toast.success("Đăng ký thành công.");
          return true;
        } catch (error) {
          logger.error("Đăng ký thất bại", {
            message: axios.isAxiosError(error)
              ? error.response?.data?.message || error.message
              : String(error),
          });
          toast.error(getAxiosMessage(error, "Đăng ký không thành công."));
          return false;
        } finally {
          set({ loading: false });
        }
      },

      signIn: async (userName, password) => {
        try {
          set({ loading: true });

          const result = await authService.signIn(userName, password);

          if ("requiresEmailVerification" in result) {
            get().setPendingGoogleVerification(
              result.verificationToken,
              result.email,
              result.purpose,
              result.resendAvailableAt,
            );
            toast.success(normalizeToastMessage(result.message));
            return "verify_email";
          }

          get().setAccessToken(result.accessToken);
          get().clearPendingEmailVerification();
          await get().fetchMe();
          useChatStore.getState().fetchConversations();

          toast.success("Chào mừng bạn quay lại.");
          return "signed_in";
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 401) {
            toast.error("Sai tên tài khoản hoặc mật khẩu. Vui lòng nhập lại.");
            return false;
          }

          toast.error(
            getAxiosMessage(error, "Đăng nhập không thành công. Thử lại."),
          );
          return false;
        } finally {
          set({ loading: false });
        }
      },

      completeGoogleSignIn: async (code) => {
        try {
          get().clearState();
          set({ loading: true });

          const result = await authService.googleCallback(code);

          if ("requiresEmailVerification" in result) {
            get().setPendingGoogleVerification(
              result.verificationToken,
              result.email,
              result.purpose,
              result.resendAvailableAt,
            );
            toast.success(normalizeToastMessage(result.message));
            return false;
          }

          get().setAccessToken(result.accessToken);
          get().setPendingGoogleVerification(null, null, null, null);
          await get().fetchMe();
          useChatStore.getState().fetchConversations();

          toast.success("Đăng nhập Google thành công.");
          return true;
        } catch (error) {
          logger.error("Đăng nhập Google thất bại", {
            message: axios.isAxiosError(error)
              ? error.response?.data?.message || error.message
              : String(error),
          });
          toast.error(getAxiosMessage(error, "Đăng nhập Google không thành công."));
          return false;
        } finally {
          set({ loading: false });
        }
      },

      verifyPendingEmailCode: async (code) => {
        try {
          const verificationToken = get().pendingGoogleVerificationToken;
          const purpose = get().pendingEmailVerificationPurpose;

          if (!verificationToken || !purpose) {
            toast.error("Không tìm thấy phiên xác minh email.");
            return false;
          }

          set({ loading: true });
          const result = await authService.verifyEmailCode(verificationToken, code);

          if ("accessToken" in result) {
            get().setAccessToken(result.accessToken);
            get().setPendingGoogleVerification(null, null, null, null);
            await get().fetchMe();
            useChatStore.getState().fetchConversations();
            toast.success("Xác minh email thành công.");
            return "signed_in";
          }

          get().setPendingGoogleVerification(null, null, null, null);
          toast.success(normalizeToastMessage(result.message));
          return "verified_only";
        } catch (error) {
          logger.warn("Xác minh email thất bại", {
            message: axios.isAxiosError(error)
              ? error.response?.data?.message || error.message
              : String(error),
          });
          toast.error(
            getAxiosMessage(error, "Mã xác minh không đúng hoặc đã hết hạn."),
          );
          return false;
        } finally {
          set({ loading: false });
        }
      },

      resendPendingEmailCode: async () => {
        try {
          const verificationToken = get().pendingGoogleVerificationToken;
          if (!verificationToken) {
            toast.error("Không tìm thấy phiên xác minh email.");
            return false;
          }

          set({ loading: true });
          const result = await authService.resendVerificationCode(verificationToken);
          get().setPendingGoogleVerification(
            result.verificationToken,
            result.email,
            result.purpose,
            result.resendAvailableAt,
          );
          toast.success(normalizeToastMessage(result.message));
          return true;
        } catch (error) {
          logger.warn("Gửi lại mã xác minh thất bại", {
            message: axios.isAxiosError(error)
              ? error.response?.data?.message || error.message
              : String(error),
          });

          if (axios.isAxiosError(error)) {
            const resendAvailableAt = error.response?.data?.resendAvailableAt;
            if (typeof resendAvailableAt === "number") {
              set({ pendingEmailResendAvailableAt: resendAvailableAt });
            }
          }

          toast.error(getAxiosMessage(error, "Không thể gửi lại mã xác minh."));
          return false;
        } finally {
          set({ loading: false });
        }
      },

      signOut: async () => {
        try {
          get().clearState();
          await authService.signOut();
          toast.success("Đăng xuất thành công.");
        } catch (error) {
          logger.warn("Đăng xuất gặp lỗi", {
            message: axios.isAxiosError(error)
              ? error.response?.data?.message || error.message
              : String(error),
          });
          toast.error(
            getAxiosMessage(error, "Lỗi xảy ra khi đăng xuất. Hãy thử lại sau."),
          );
        }
      },

      fetchMe: async () => {
        try {
          set({ loading: true });
          const user = await authService.fetchMe();
          set({ user });
        } catch (error) {
          logger.warn("Lấy hồ sơ người dùng thất bại", {
            message: axios.isAxiosError(error)
              ? error.response?.data?.message || error.message
              : String(error),
          });
          set({ user: null, accessToken: null });
          toast.error(
            getAxiosMessage(error, "Lỗi xảy ra khi lấy dữ liệu người dùng."),
          );
        } finally {
          set({ loading: false });
        }
      },

      refresh: async () => {
        try {
          set({ loading: true });

          const { user, fetchMe, setAccessToken } = get();
          const accessToken = await authService.refresh();

          setAccessToken(accessToken);

          if (!user) {
            await fetchMe();
          }
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 401) {
            get().clearState();
            return;
          }

          get().clearState();
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        pendingGoogleVerificationToken: state.pendingGoogleVerificationToken,
        pendingGoogleVerificationEmail: state.pendingGoogleVerificationEmail,
        pendingEmailVerificationPurpose: state.pendingEmailVerificationPurpose,
        pendingEmailResendAvailableAt: state.pendingEmailResendAvailableAt,
      }),
    },
  ),
);
