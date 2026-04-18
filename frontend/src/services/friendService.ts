import api from "@/lib/axios";
import type { DiscoverUser } from "@/types/user";

const normalizeDiscoverUser = (user: Partial<DiscoverUser> & {
  username?: string;
  userName?: string;
  avatar?: string | null;
  avatarUrl?: string | null;
}): DiscoverUser => ({
  _id: String(user._id ?? ""),
  username: String(user.username ?? user.userName ?? ""),
  userName: String(user.userName ?? user.username ?? ""),
  displayName: String(user.displayName ?? ""),
  avatar: user.avatar ?? user.avatarUrl ?? null,
  avatarUrl: user.avatarUrl ?? user.avatar ?? null,
  mutualFriendsCount: Number(user.mutualFriendsCount ?? 0),
  isFriend: Boolean(user.isFriend),
  requestSent: Boolean(user.requestSent),
  requestReceived: Boolean(user.requestReceived),
});

export const friendService = {
  async searchByUserName(userName: string) {
    const res = await api.get(`/users/search?q=${encodeURIComponent(userName)}&limit=1`);
    const firstUser = res.data.users?.[0];

    if (!firstUser) {
      return null;
    }

    const normalized = normalizeDiscoverUser(firstUser);

    return {
      _id: normalized._id,
      userName: normalized.userName,
      email: "",
      displayName: normalized.displayName,
      avatarUrl: normalized.avatarUrl ?? undefined,
    };
  },

  async searchUsers(query: string, limit = 10): Promise<DiscoverUser[]> {
    const res = await api.get(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return (res.data.users ?? []).map(normalizeDiscoverUser);
  },

  async getSuggestions(limit = 10): Promise<DiscoverUser[]> {
    const res = await api.get(`/users/suggestions?limit=${limit}`, {
      timeout: 8000,
    });
    return (res.data.users ?? []).map(normalizeDiscoverUser);
  },

  async sendFriendRequest(to: string, message?: string) {
    const res = await api.post("/friends/requests", { to, message });
    return res.data.message;
  },

  async getAllFriendRequest() {
    const res = await api.get("/friends/requests");
    const { sent, received } = res.data;
    return { sent, received };
  },

  async acceptRequest(requestId: string) {
    const res = await api.post(`/friends/requests/${requestId}/accept`);
    return res.data.requestAcceptedBy;
  },

  async declineRequest(requestId: string) {
    await api.post(`/friends/requests/${requestId}/decline`);
  },

  async cancelRequest(requestId: string) {
    const res = await api.delete(`/friends/requests/${requestId}`);
    return res.data.message;
  },

  async getFriendList() {
    const res = await api.get("/friends");
    return res.data.friends;
  },
};
