import { axiosInstance } from "@/lib/axios";

interface MaintenanceStatus {
  isEnabled: boolean;
  message: string;
  enabledAt: string | null;
  enabledBy: string | null;
  disabledAt: string | null;
  disabledBy: string | null;
}

interface VerifyPasswordResponse {
  message: string;
  expiresAt: number;
}

interface ConfirmToggleResponse {
  message: string;
  isEnabled: boolean;
  enabledAt: string | null;
  disabledAt: string | null;
}

interface UpdateMessageResponse {
  message: string;
  maintenanceMessage: string;
}

export const maintenanceService = {
  // Get current maintenance status
  getStatus: async (): Promise<MaintenanceStatus> => {
    const { data } = await axiosInstance.get("/admin/maintenance/status");
    return data;
  },

  // Step 1: Request password verification
  requestPasswordVerification: async (): Promise<{ email: string }> => {
    const { data } = await axiosInstance.post(
      "/admin/maintenance/request-verification"
    );
    return data;
  },

  // Step 1.5: Verify password and send confirmation code
  verifyPassword: async (
    password: string
  ): Promise<VerifyPasswordResponse> => {
    const { data } = await axiosInstance.post(
      "/admin/maintenance/verify-password",
      { password }
    );
    return data;
  },

  // Step 2: Verify confirmation code and toggle maintenance
  confirmToggle: async (
    code: string,
    enable: boolean
  ): Promise<ConfirmToggleResponse> => {
    const { data } = await axiosInstance.post(
      "/admin/maintenance/confirm-toggle",
      { code, enable }
    );
    return data;
  },

  // Update maintenance message
  updateMessage: async (message: string): Promise<UpdateMessageResponse> => {
    const { data } = await axiosInstance.patch(
      "/admin/maintenance/message",
      { message }
    );
    return data;
  },
};
