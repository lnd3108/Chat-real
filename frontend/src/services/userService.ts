import api from "@/lib/axios";

export const userService = {
  //   UploadAvatar: async (formData: FormData) => {
  //     const res = await api.post("/users/uploadAvatar", formData, {
  //       headers: {
  //         "Content-Type": "multipart/form-data",
  //       },
  //     });

  //     if (res.status === 400) {
  //       throw new Error(res.data.message);
  //     }

  //     return res.data;
  //   },
  UploadAvatar: async (formData: FormData) => {
    try {
      const res = await api.post("/users/uploadAvatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    } catch (err: any) {
      throw new Error(err?.response?.data?.message || "Upload failed");
    }
  },
};
