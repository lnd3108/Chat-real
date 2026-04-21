import api from "@/lib/axios";
import axios from "axios";
import type { BlockedUser, User } from "@/types/user";
import { getErrorMessage } from "@/lib/httpError";

export const userService = {
  updateMyProfile: async (payload: {
    displayName: string;
    userName: string;
    email: string;
    phone: string | null | string;
    bio: string | null | string;
  }) => {
    try {
      const res = await api.patch("/users/me/profile", payload);
      return res.data as
        | {
            success: true;
            mode: "updated";
            user: User;
            message: string;
          }
        | {
            success: true;
            mode: "email_verification_required";
            pendingEmail: string;
            resendAfter?: number;
            message: string;
          };
    } catch (error) {
      throw new Error(getErrorMessage(error, "Không thể cập nhật thông tin cá nhân."));
    }
  },

  sendEmailChangeOtp: async (newEmail: string) => {
    try {
      const res = await api.post("/users/me/email-change/send-otp", { newEmail });
      return res.data as {
        success: true;
        pendingEmail: string;
        resendAfter?: number;
        message: string;
      };
    } catch (error) {
      throw new Error(getErrorMessage(error, "Không thể gửi mã xác minh email mới."));
    }
  },

  verifyEmailChange: async ({
    newEmail,
    otp,
  }: {
    newEmail: string;
    otp: string;
  }) => {
    try {
      const res = await api.post("/users/me/email-change/verify", { newEmail, otp });
      return res.data as {
        success: true;
        user: User;
        message: string;
      };
    } catch (error) {
      throw new Error(getErrorMessage(error, "Không thể xác minh email mới."));
    }
  },

  cancelEmailChange: async (newEmail?: string | null) => {
    try {
      const res = await api.post("/users/me/email-change/cancel", { newEmail });
      return res.data as {
        success: true;
        message: string;
      };
    } catch (error) {
      throw new Error(getErrorMessage(error, "Không thể hủy xác minh email mới."));
    }
  },

  UploadAvatar: async (formData: FormData) => {
    try {
      const res = await api.post("/users/uploadAvatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || "Upload failed");
      }

      throw new Error("Upload failed");
    }
  },

  getBlockedUsers: async (): Promise<BlockedUser[]> => {
    const res = await api.get("/users/blocks");
    return res.data.blockedUsers ?? [];
  },

  blockUser: async (targetUserId: string, reason?: string): Promise<BlockedUser[]> => {
    const res = await api.post(`/users/blocks/${targetUserId}`, { reason });
    return res.data.blockedUsers ?? [];
  },

  unblockUser: async (targetUserId: string): Promise<BlockedUser[]> => {
    const res = await api.delete(`/users/blocks/${targetUserId}`);
    return res.data.blockedUsers ?? [];
  },
};
