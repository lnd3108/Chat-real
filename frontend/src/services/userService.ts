import api from "@/lib/axios";
import axios from "axios";
import type { BlockedUser } from "@/types/user";

export const userService = {
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
