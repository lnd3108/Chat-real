export interface User {
  _id: string;
  userName: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string | null;
  phone?: string | null;
  createAt?: string;
  updateAt?: string;
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
