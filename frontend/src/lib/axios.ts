import { useAuthStore } from "@/stores/useAuthStore";
import axios from "axios";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// Global AbortController for cancelling requests on account deletion
let globalAbortController = new AbortController();
let isAccountDeleted = false;

const handleForcedSignOut = (message?: string) => {
  useAuthStore.getState().clearState();

  if (typeof window !== "undefined") {
    if (message) {
      toast.error(message);
    }

    if (window.location.pathname !== "/signin") {
      window.location.href = "/signin";
    }
  }
};

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
    const status = error.response?.status;
    const shouldLogResponseError =
      typeof status !== "number" || status >= 500;

    if (shouldLogResponseError) {
      logger.warn("API response error", {
        method: error.config?.method,
        url: error.config?.url,
        status,
        message: error.response?.data?.message || error.message,
      });
    }

    // Don't retry if account was deleted
    if (isAccountDeleted) {
      return Promise.reject(error);
    }

    const originalRequest = error.config ?? {};
    const { accessToken } = useAuthStore.getState();
    const errorCode = error.response?.data?.code;
    const errorMessage = error.response?.data?.message;

    if (
      errorCode === "ACCOUNT_BANNED" &&
      !String(originalRequest.url).includes("/auth/signin") &&
      !String(originalRequest.url).includes("/auth/google/callback")
    ) {
      handleForcedSignOut(errorMessage || "Tài khoản của bạn đã bị khóa.");
      return Promise.reject(error);
    }

    if (
      String(originalRequest.url).includes("/auth/signin") ||
      String(originalRequest.url).includes("/auth/signup") ||
      String(originalRequest.url).includes("/auth/refresh") ||
      (String(originalRequest.url).includes("/users/me") &&
        originalRequest.method === "delete")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retryCount = originalRequest._retryCount || 0;

    if (error.response?.status === 403 && !accessToken) {
      return Promise.reject(error);
    }

    const shouldRetryAuth =
      error.response?.status === 403 &&
      typeof errorMessage === "string" &&
      errorMessage.toLowerCase().includes("access token");

    if (shouldRetryAuth && originalRequest._retryCount < 4) {
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
        const refreshMessage = axios.isAxiosError(refreshError)
          ? refreshError.response?.data?.message || refreshError.message
          : refreshError instanceof Error
            ? refreshError.message
            : String(refreshError);
        const refreshStatus = axios.isAxiosError(refreshError)
          ? refreshError.response?.status
          : undefined;

        logger.warn("Không thể làm mới phiên đăng nhập", {
          status: refreshStatus,
          message: refreshMessage,
        });
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
