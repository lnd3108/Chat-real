import { useAuthStore } from "@/stores/useAuthStore";
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// Gắn accessToken vào req header
api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

// Tự động gọi refresh api khi access token hết hạn

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalResquest = error.config;

    // nhưng api không cần check
    if (
      originalResquest.url.includes("/auth/signin") ||
      originalResquest.url.includes("/auth/signup") ||
      originalResquest.url.includes("/auth/refresh")
    ) {
      return Promise.reject(error);
    }

    originalResquest._retryCount = originalResquest._retryCount || 0;

    if (error.response?.status === 403 && originalResquest._retryCount < 4) {
      originalResquest._retryCount += 1;

      console.log("refresh", originalResquest._retryCount);

      try {
        const res = await api.post("/auth/refresh", { withCredentials: true });
        const newAccessToken = res.data.accessToken;

        useAuthStore.getState().setAccessToken(newAccessToken);

        originalResquest.headers.Authorization = `Bearer ${newAccessToken}`;

        return api(originalResquest);
      } catch (refreshError) {
        useAuthStore.getState().clearState();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
