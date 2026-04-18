export interface User {
  _id: string;
  userName: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  authProvider?: "local" | "google";
  emailVerified?: boolean;
  bio?: string | null;
  phone?: string | null;
  createAt?: string;
  updateAt?: string;
}

export interface DiscoverUser {
  _id: string;
  username: string;
  userName: string;
  displayName: string;
  avatar?: string | null;
  avatarUrl?: string | null;
  mutualFriendsCount: number;
  isFriend: boolean;
  requestSent: boolean;
  requestReceived: boolean;
}

export interface BlockedUser {
  _id: string;
  userName: string;
  displayName: string;
  avatarUrl?: string | null;
  reason?: string | null;
  createdAt: string;
}

export interface Friend {
  _id: string;
  userName: string;
  displayName: string;
  avatarUrl?: string;
}

export interface FriendRequest {
  _id: string;
  from?: {
    _id: string;
    userName: string;
    displayName: string;
    avatarUrl?: string;
  };
  to?: {
    _id: string;
    userName: string;
    displayName: string;
    avatarUrl?: string;
  };
  message: string;
  createdAt: string;
  updatedAt: string;
}
