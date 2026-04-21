export interface User {
  _id: string;
  userName: string;
  email: string;
  displayName: string;
  role?: "user" | "admin";
  roles?: Array<"USER" | "SUPPORT" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN">;
  primaryRole?: "USER" | "SUPPORT" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";
  permissions?: string[];
  status?: "active" | "inactive" | "suspended" | "banned";
  avatarUrl?: string | null;
  authProvider?: "local" | "google";
  emailVerified?: boolean;
  bio?: string | null;
  phone?: string | null;
  createAt?: string;
  updateAt?: string;
}

export interface DiscoverUser {
  id?: string;
  fullName?: string;
  _id: string;
  username: string;
  userName: string;
  displayName: string;
  avatar?: string | null;
  avatarUrl?: string | null;
  mutualFriendsCount: number;
  reasonText?: string;
  isFriend: boolean;
  requestSent: boolean;
  requestReceived: boolean;
  canSendFriendRequest?: boolean;
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
  status?: "pending" | "accepted" | "rejected" | "cancelled";
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
