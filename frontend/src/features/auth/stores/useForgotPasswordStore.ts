import axios from "axios";
import { create } from "zustand";
import { toast } from "sonner";
import { authService } from "@/features/auth/services/authService";
import { normalizeToastMessage } from "@/shared/lib/toastMessage";

type ForgotPasswordStep = "email" | "otp" | "reset" | "success";

type ForgotPasswordState = {
  step: ForgotPasswordStep;
  email: string;
  resendAvailableAt: number | null;
  resetToken: string | null;
  resetTokenValue: string | null;
  resetTokenExpiresAt: number | null;
  loading: boolean;
  verifySuccess: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  setEmail: (email: string) => void;
  goToStep: (step: ForgotPasswordStep) => void;
  clearError: () => void;
  resetFlow: () => void;
  requestOtp: (email: string) => Promise<boolean>;
  resendOtp: () => Promise<boolean>;
  verifyOtp: (otp: string) => Promise<boolean>;
  resetPassword: (
    newPassword: string,
    confirmPassword: string,
  ) => Promise<boolean>;
};

const getAxiosMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return normalizeToastMessage(message);
    }
  }

  return fallback;
};

export const useForgotPasswordStore = create<ForgotPasswordState>((set, get) => ({
  step: "email",
  email: "",
  resendAvailableAt: null,
  resetToken: null,
  resetTokenValue: null,
  resetTokenExpiresAt: null,
  loading: false,
  verifySuccess: false,
  errorMessage: null,
  successMessage: null,

  setEmail: (email) => set({ email, errorMessage: null }),

  goToStep: (step) => set({ step, errorMessage: null }),

  clearError: () => set({ errorMessage: null }),

  resetFlow: () =>
    set({
      step: "email",
      email: "",
      resendAvailableAt: null,
      resetToken: null,
      resetTokenValue: null,
      resetTokenExpiresAt: null,
      loading: false,
      verifySuccess: false,
      errorMessage: null,
      successMessage: null,
    }),

  requestOtp: async (email) => {
    try {
      set({ loading: true, errorMessage: null, successMessage: null });
      const result = await authService.forgotPassword(email);

      set({
        email,
        step: "otp",
        resendAvailableAt: result.resendAvailableAt ?? Date.now() + 60_000,
        successMessage: normalizeToastMessage(result.message),
      });
      toast.success(normalizeToastMessage(result.message));
      return true;
    } catch (error) {
      const message = getAxiosMessage(error, "Không thể gửi mã xác nhận.");
      const resendAvailableAt = axios.isAxiosError(error)
        ? error.response?.data?.resendAvailableAt
        : null;

      set({
        loading: false,
        errorMessage: message,
        resendAvailableAt:
          typeof resendAvailableAt === "number" ? resendAvailableAt : null,
      });
      toast.error(message);
      return false;
    } finally {
      set({ loading: false });
    }
  },

  resendOtp: async () => {
    const { email } = get();
    return get().requestOtp(email);
  },

  verifyOtp: async (otp) => {
    try {
      const { email } = get();

      set({ loading: true, errorMessage: null, successMessage: null });
      const result = await authService.verifyForgotPasswordOtp(email, otp);

      set({
        step: "reset",
        verifySuccess: true,
        resetToken: result.resetToken,
        resetTokenValue: result.resetTokenValue,
        resetTokenExpiresAt: result.resetTokenExpiresAt,
        successMessage: normalizeToastMessage(result.message),
      });
      toast.success(normalizeToastMessage(result.message));
      return true;
    } catch (error) {
      const message = getAxiosMessage(error, "Mã xác nhận không hợp lệ.");
      set({ errorMessage: message });
      toast.error(message);
      return false;
    } finally {
      set({ loading: false });
    }
  },

  resetPassword: async (newPassword, confirmPassword) => {
    try {
      const { email, resetToken, resetTokenValue, resetTokenExpiresAt } = get();

      if (!email || !resetToken || !resetTokenValue) {
        const message =
          "Thiếu thông tin xác thực phiên đặt lại mật khẩu. Vui lòng thực hiện lại từ đầu.";
        set({ step: "email", errorMessage: message });
        toast.error(message);
        return false;
      }

      if (resetTokenExpiresAt && resetTokenExpiresAt <= Date.now()) {
        const message =
          "Phiên đặt lại mật khẩu đã hết hạn. Vui lòng xác minh lại mã OTP.";
        set({
          step: "otp",
          resetToken: null,
          resetTokenValue: null,
          resetTokenExpiresAt: null,
          errorMessage: message,
        });
        toast.error(message);
        return false;
      }

      set({ loading: true, errorMessage: null, successMessage: null });
      const result = await authService.resetPassword({
        email,
        resetToken,
        resetTokenValue,
        newPassword,
        confirmPassword,
      });

      set({
        step: "success",
        verifySuccess: true,
        successMessage: normalizeToastMessage(result.message),
      });
      toast.success(normalizeToastMessage(result.message));
      return true;
    } catch (error) {
      const message = getAxiosMessage(error, "Không thể đặt lại mật khẩu.");
      set({ errorMessage: message });
      toast.error(message);
      return false;
    } finally {
      set({ loading: false });
    }
  },
}));
