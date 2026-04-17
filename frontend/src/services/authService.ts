import api from "@/lib/axios";

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
    return res.data as {
      message: string;
      accessToken: string;
      user: {
        id: string;
        userName: string;
        displayName: string;
        email: string;
        avatarUrl: string | null;
      };
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
          message: string;
        };
  },

  verifyGoogleEmailCode: async (verificationToken: string, code: string) => {
    const res = await api.post(
      "/auth/google/verify-email",
      { verificationToken, code },
      { withCredentials: true },
    );

    return res.data as {
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
