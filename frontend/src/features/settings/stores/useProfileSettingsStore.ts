import { create } from "zustand";
import { userService } from "@/features/settings/services/userService";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import type { User } from "@/shared/types/user";

type ProfileMode = "edit" | "verify_email_change";

type ProfileFormValues = {
  displayName: string;
  userName: string;
  email: string;
  phone: string;
  bio: string;
};

type SaveProfileResult =
  | { ok: true; mode: "updated"; message: string }
  | {
      ok: true;
      mode: "email_verification_required";
      message: string;
      pendingEmail: string;
      resendAfter?: number;
    }
  | { ok: false; message: string };

type ProfileSettingsState = {
  mode: ProfileMode;
  formValues: ProfileFormValues;
  originalValues: ProfileFormValues;
  pendingEmail: string | null;
  otp: string;
  resendAvailableAt: number | null;
  isSaving: boolean;
  isSendingOtp: boolean;
  isVerifyingOtp: boolean;
  isCancellingPending: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  initialize: (user: User | null) => void;
  reset: () => void;
  setField: (field: keyof ProfileFormValues, value: string) => void;
  setOtp: (otp: string) => void;
  backToEdit: () => Promise<{ ok: boolean; message: string }>;
  saveChanges: () => Promise<SaveProfileResult>;
  resendOtp: () => Promise<{ ok: boolean; message: string }>;
  verifyOtpAndCommit: () => Promise<{ ok: boolean; message: string }>;
  cancelPendingVerification: () => Promise<{ ok: boolean; message: string }>;
};

const emptyForm: ProfileFormValues = {
  displayName: "",
  userName: "",
  email: "",
  phone: "",
  bio: "",
};

const toFormValues = (user: User | null): ProfileFormValues => ({
  displayName: user?.displayName ?? "",
  userName: user?.userName ?? "",
  email: user?.email ?? "",
  phone: user?.phone ?? "",
  bio: user?.bio ?? "",
});

export const useProfileSettingsStore = create<ProfileSettingsState>((set, get) => ({
  mode: "edit",
  formValues: emptyForm,
  originalValues: emptyForm,
  pendingEmail: null,
  otp: "",
  resendAvailableAt: null,
  isSaving: false,
  isSendingOtp: false,
  isVerifyingOtp: false,
  isCancellingPending: false,
  errorMessage: null,
  successMessage: null,

  initialize: (user) => {
    if (get().mode === "verify_email_change") {
      return;
    }

    const values = toFormValues(user);
    set({
      mode: "edit",
      formValues: values,
      originalValues: values,
      pendingEmail: null,
      otp: "",
      resendAvailableAt: null,
      isSaving: false,
      isSendingOtp: false,
      isVerifyingOtp: false,
      isCancellingPending: false,
      errorMessage: null,
      successMessage: null,
    });
  },

  reset: () =>
    set({
      mode: "edit",
      formValues: emptyForm,
      originalValues: emptyForm,
      pendingEmail: null,
      otp: "",
      resendAvailableAt: null,
      isSaving: false,
      isSendingOtp: false,
      isVerifyingOtp: false,
      isCancellingPending: false,
      errorMessage: null,
      successMessage: null,
    }),

  setField: (field, value) =>
    set((state) => ({
      formValues: {
        ...state.formValues,
        [field]: value,
      },
      errorMessage: null,
      successMessage: null,
    })),

  setOtp: (otp) => set({ otp, errorMessage: null }),

  backToEdit: async () => {
    const result = await get().cancelPendingVerification();
    if (!result.ok) {
      return result;
    }

    set({
      mode: "edit",
      otp: "",
      errorMessage: null,
      successMessage: null,
      pendingEmail: null,
      resendAvailableAt: null,
    });

    return result;
  },

  saveChanges: async () => {
    try {
      set({
        isSaving: true,
        errorMessage: null,
        successMessage: null,
      });

      const { formValues } = get();
      const result = await userService.updateMyProfile({
        displayName: formValues.displayName,
        userName: formValues.userName,
        email: formValues.email,
        phone: formValues.phone,
        bio: formValues.bio,
      });

      if (result.mode === "updated") {
        useAuthStore.getState().setUser(result.user);
        const values = toFormValues(result.user);
        set({
          mode: "edit",
          formValues: values,
          originalValues: values,
          pendingEmail: null,
          otp: "",
          resendAvailableAt: null,
          successMessage: result.message,
        });

        return { ok: true, mode: "updated", message: result.message };
      }

      set({
        mode: "verify_email_change",
        pendingEmail: result.pendingEmail,
        resendAvailableAt: result.resendAfter ?? null,
        otp: "",
        successMessage: result.message,
      });

      return {
        ok: true,
        mode: "email_verification_required",
        message: result.message,
        pendingEmail: result.pendingEmail,
        resendAfter: result.resendAfter,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể lưu thay đổi.";
      set({ errorMessage: message });
      return { ok: false, message };
    } finally {
      set({ isSaving: false });
    }
  },

  resendOtp: async () => {
    try {
      set({
        isSendingOtp: true,
        errorMessage: null,
        successMessage: null,
      });

      const { pendingEmail } = get();
      const result = await userService.sendEmailChangeOtp(pendingEmail || "");

      set({
        resendAvailableAt: result.resendAfter ?? null,
        successMessage: result.message,
      });

      return { ok: true, message: result.message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể gửi lại mã xác minh.";
      set({ errorMessage: message });
      return { ok: false, message };
    } finally {
      set({ isSendingOtp: false });
    }
  },

  verifyOtpAndCommit: async () => {
    try {
      set({
        isVerifyingOtp: true,
        errorMessage: null,
        successMessage: null,
      });

      const { pendingEmail, otp } = get();
      const result = await userService.verifyEmailChange({
        newEmail: pendingEmail || "",
        otp,
      });

      useAuthStore.getState().setUser(result.user);
      const values = toFormValues(result.user);
      set({
        mode: "edit",
        formValues: values,
        originalValues: values,
        pendingEmail: null,
        otp: "",
        resendAvailableAt: null,
        successMessage: result.message,
      });

      return { ok: true, message: result.message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể xác minh email mới.";
      set({ errorMessage: message });
      return { ok: false, message };
    } finally {
      set({ isVerifyingOtp: false });
    }
  },

  cancelPendingVerification: async () => {
    const { pendingEmail, mode } = get();
    if (mode !== "verify_email_change" || !pendingEmail) {
      return { ok: true, message: "Không có phiên xác minh đang chờ." };
    }

    try {
      set({
        isCancellingPending: true,
        errorMessage: null,
      });

      const result = await userService.cancelEmailChange(pendingEmail);
      return { ok: true, message: result.message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể hủy xác minh email mới.";
      set({ errorMessage: message });
      return { ok: false, message };
    } finally {
      set({ isCancellingPending: false });
    }
  },
}));
