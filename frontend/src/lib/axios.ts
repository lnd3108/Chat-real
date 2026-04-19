import { useAuthStore } from "@/stores/useAuthStore";
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// Global AbortController for cancelling requests on account deletion
let globalAbortController = new AbortController();
let isAccountDeleted = false;

// Export function to abort all pending requests
export const abortAllRequests = () => {
  isAccountDeleted = true;
  globalAbortController.abort();
  globalAbortController = new AbortController();
};

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  // Add global abort signal to all requests
  config.signal = globalAbortController.signal;

  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // Don't retry if account was deleted
    if (isAccountDeleted) {
      return Promise.reject(error);
    }

    const originalRequest = error.config;
    const { accessToken } = useAuthStore.getState();

    if (
      originalRequest.url.includes("/auth/signin") ||
      originalRequest.url.includes("/auth/signup") ||
      originalRequest.url.includes("/auth/refresh") ||
      (originalRequest.url.includes("/users/me") && originalRequest.method === "delete")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retryCount = originalRequest._retryCount || 0;

    if (error.response?.status === 403 && !accessToken) {
      return Promise.reject(error);
    }

    if (error.response?.status === 403 && originalRequest._retryCount < 4) {
      originalRequest._retryCount += 1;

      try {
        const res = await api.post(
          "/auth/refresh",
          {},
          { withCredentials: true },
        );
        const newAccessToken = res.data.accessToken;

        useAuthStore.getState().setAccessToken(newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        // If refresh fails, clear state and reject
        useAuthStore.getState().clearState();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export const axiosInstance = api;
export default api;
