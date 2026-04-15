import { create } from "zustand";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import type { AuthState } from "@/types/store";
import { persist } from "zustand/middleware";
import { useChatStore } from "./useChatStore";
import axios from "axios";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      loading: false,

      setAccessToken: (accessToken) => {
        set({ accessToken });
      },

      setUser: (user) => {
        set({ user });
      },
      clearState: () => {
        set({ accessToken: null, user: null, loading: false });
        useChatStore.getState().reset();
        // localStorage.clear();
        // sessionStorage.clear();
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
          //Gọi Api
          await authService.signUp(
            userName,
            password,
            email,
            firstName,
            lastName,
          );

          toast.success(
            "Đăng ký thành công! Bạn sẽ được chuyển sang trang đăng nhập.",
          );
        } catch (error) {
          console.error(error);
          toast.error("Đăng ký không thành công");
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

          toast.success("Chào mừng bạn quay lại 🎉");
          return true;
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 401) {
            toast.error("Sai tên tài khoản hoặc mật khẩu. Vui lòng nhập lại!");
            return false;
          }

          toast.error("Đăng nhập không thành công. Thử lại!");
          return false;
        } finally {
          set({ loading: false });
        }
      },

      signOut: async () => {
        try {
          get().clearState();
          await authService.signOut();
          toast.success("Logout Thành Công!");
        } catch (error) {
          console.error(error);
          toast.error("Lỗi xảy ra khi Logout. Hãy thử lại sau");
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
          toast.error("Lỗi xảy ra khi lây dữ lệu người dùng. Hãy Thử lại!");
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
          // ✅ KHÔNG console.error

          if (axios.isAxiosError(error) && error.response?.status === 401) {
            // refresh fail => coi như chưa đăng nhập
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
        user: state.user, // Chỉ lưu trữ thông tin user
      }),
    },
  ),
);
