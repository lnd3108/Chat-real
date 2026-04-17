import api from "@/lib/axios";
import axios from "axios";

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
};
