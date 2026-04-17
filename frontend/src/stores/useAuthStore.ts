import { create } from "zustand";
import { toast } from "sonner";
import { persist } from "zustand/middleware";
import axios from "axios";
import { authService } from "@/services/authService";
import type { AuthState } from "@/types/store";
import { useChatStore } from "./useChatStore";

const getAxiosMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
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

      setAccessToken: (accessToken) => {
        set({ accessToken });
      },

      setUser: (user) => {
        set({ user });
      },

      setPendingGoogleVerification: (verificationToken, email) => {
        set({
          pendingGoogleVerificationToken: verificationToken,
          pendingGoogleVerificationEmail: email,
        });
      },

      clearState: () => {
        set({
          accessToken: null,
          user: null,
          loading: false,
          pendingGoogleVerificationToken: null,
          pendingGoogleVerificationEmail: null,
        });
        useChatStore.getState().reset();
        localStorage.removeItem("auth-storage");
        localStorage.removeItem("chat-storage");

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
          await authService.signUp(
            userName,
            password,
            email,
            firstName,
            lastName,
          );

          toast.success("Đăng ký thành công. Bạn sẽ được chuyển sang trang đăng nhập.");
          return true;
        } catch (error) {
          console.error(error);
          toast.error(getAxiosMessage(error, "Đăng ký không thành công."));
          return false;
        } finally {
          set({ loading: false });
        }
      },

      signIn: async (userName, password) => {
        try {
          get().clearState();
          set({ loading: true });

          const { accessToken } = await authService.signIn(userName, password);

          get().setAccessToken(accessToken);
          await get().fetchMe();
          useChatStore.getState().fetchConversations();

          toast.success("Chào mừng bạn quay lại.");
          return true;
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
            );
            toast.success("Mã xác minh đã được gửi tới Gmail của bạn.");
            return false;
          }

          get().setAccessToken(result.accessToken);
          get().setPendingGoogleVerification(null, null);
          await get().fetchMe();
          useChatStore.getState().fetchConversations();

          toast.success("Đăng nhập Google thành công.");
          return true;
        } catch (error) {
          console.error(error);
          toast.error(
            getAxiosMessage(error, "Đăng nhập Google không thành công."),
          );
          return false;
        } finally {
          set({ loading: false });
        }
      },

      verifyGoogleEmailCode: async (code) => {
        try {
          const verificationToken = get().pendingGoogleVerificationToken;
          if (!verificationToken) {
            toast.error("Không tìm thấy phiên xác minh Google.");
            return false;
          }

          set({ loading: true });
          const result = await authService.verifyGoogleEmailCode(
            verificationToken,
            code,
          );

          get().setAccessToken(result.accessToken);
          get().setPendingGoogleVerification(null, null);
          await get().fetchMe();
          useChatStore.getState().fetchConversations();

          toast.success("Xác minh email thành công.");
          return true;
        } catch (error) {
          console.error(error);
          toast.error(
            getAxiosMessage(error, "Mã xác minh không đúng hoặc đã hết hạn."),
          );
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
          console.error(error);
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
          console.error(error);
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
      }),
    },
  ),
);
