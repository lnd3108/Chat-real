import api from "@/shared/api/axios";

export const authService = {
  getGoogleStartUrl: () => `${api.defaults.baseURL}/auth/oauth2/google`,

  signUp: async (
    userName: string,
    password: string,
    email: string,
    firstName: string,
    lastName: string,
  ) => {
    const res = await api.post(
      "/auth/signup",
      { userName, password, email, firstName, lastName },
      { withCredentials: true },
    );

    return res.data;
  },

  signIn: async (userName: string, password: string) => {
    const res = await api.post(
      "/auth/signin",
      { userName, password },
      { withCredentials: true },
    );
    return res.data as
      | {
          message: string;
          accessToken: string;
          user: {
            id: string;
            userName: string;
            displayName: string;
            email: string;
            avatarUrl: string | null;
          };
        }
      | {
          requiresEmailVerification: true;
          verificationToken: string;
          email: string;
          purpose: "signup" | "google-signin";
          resendAvailableAt: number;
          message: string;
        };
  },

  googleCallback: async (code: string) => {
    const res = await api.post(
      "/auth/google/callback",
      { code },
      { withCredentials: true },
    );

    return res.data as
      | {
          message: string;
          accessToken: string;
          user: {
            id: string;
            userName: string;
            displayName: string;
            email: string;
            avatarUrl: string | null;
            authProvider: "local" | "google";
            emailVerified: boolean;
          };
        }
      | {
          requiresEmailVerification: true;
          verificationToken: string;
          email: string;
          purpose: "signup" | "google-signin";
          resendAvailableAt: number;
          message: string;
        };
  },

  verifyEmailCode: async (verificationToken: string, code: string) => {
    const res = await api.post(
      "/auth/verify-email",
      { verificationToken, code },
      { withCredentials: true },
    );

    return res.data as
      | {
          message: string;
        }
      | {
          message: string;
          accessToken: string;
          user: {
            id: string;
            userName: string;
            displayName: string;
            email: string;
            avatarUrl: string | null;
            authProvider: "local" | "google";
            emailVerified: boolean;
          };
        };
  },

  resendVerificationCode: async (verificationToken: string) => {
    const res = await api.post(
      "/auth/resend-verification",
      { verificationToken },
      { withCredentials: true },
    );

    return res.data as {
      requiresEmailVerification: true;
      verificationToken: string;
      email: string;
      purpose: "signup" | "google-signin";
      resendAvailableAt: number;
      message: string;
    };
  },

  forgotPassword: async (email: string) => {
    const res = await api.post("/auth/forgot-password", { email });

    return res.data as {
      message: string;
      resendAvailableAt?: number;
    };
  },

  verifyForgotPasswordOtp: async (email: string, otp: string) => {
    const res = await api.post("/auth/verify-forgot-password-otp", {
      email,
      otp,
    });

    return res.data as {
      message: string;
      resetToken: string;
      resetTokenValue: string;
      resetTokenExpiresAt: number;
    };
  },

  resetPassword: async ({
    email,
    resetToken,
    resetTokenValue,
    newPassword,
    confirmPassword,
  }: {
    email: string;
    resetToken: string | null;
    resetTokenValue: string | null;
    newPassword: string;
    confirmPassword: string;
  }) => {
    const res = await api.post("/auth/reset-password", {
      email,
      resetToken,
      resetTokenValue,
      newPassword,
      confirmPassword,
    });

    return res.data as {
      message: string;
    };
  },

  requestAccountDeletionCode: async () => {
    const res = await api.post(
      "/auth/delete-account/request",
      {},
      { withCredentials: true },
    );

    return res.data as {
      message: string;
      email: string;
      expiresAt: number;
      resendAvailableAt: number;
    };
  },

  confirmAccountDeletion: async (confirmationText: string, code: string) => {
    const res = await api.delete("/users/me", {
      data: { confirmationText, code },
      withCredentials: true,
    });

    return res.data as {
      success: boolean;
      message: string;
      data: {
        deletedDirectConversationsCount: number;
        deletedDirectMessagesCount: number;
        affectedGroupsCount: number;
        anonymizedGroupMessagesCount: number;
      };
    };
  },

  signOut: async () => {
    return api.post("/auth/signout", {}, { withCredentials: true });
  },

  fetchMe: async () => {
    const res = await api.get("/users/me", { withCredentials: true });
    return res.data.user;
  },

  refresh: async () => {
    const res = await api.post("/auth/refresh/", {}, { withCredentials: true });
    return res.data.accessToken;
  },
};
