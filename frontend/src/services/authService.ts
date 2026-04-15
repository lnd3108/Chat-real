import api from "@/lib/axios";

export const authService = {
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
