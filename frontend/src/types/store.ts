import type { Socket } from "socket.io-client";
import type { Conversation, DirectBlockInfo, LastMessage, Message } from "./chat";
import type { Friend, FriendRequest, User } from "./user";

export interface ConversationPatch {
  _id: string;
  type?: Conversation["type"];
  group?: Conversation["group"];
  participants?: Conversation["participants"];
  lastMessageAt?: string;
  seenBy?: Conversation["seenBy"] | string[];
  lastMessage?: LastMessage | null;
  unreadCounts?: Record<string, number>;
  blockInfo?: DirectBlockInfo;
  moveToTop?: boolean;
}

export interface AuthState {
  accessToken: string | null;
  user: User | null;
  loading: boolean;
  pendingGoogleVerificationToken: string | null;
  pendingGoogleVerificationEmail: string | null;
  pendingEmailVerificationPurpose: "signup" | "google-signin" | null;
  pendingEmailResendAvailableAt: number | null;

  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  setPendingGoogleVerification: (
    verificationToken: string | null,
    email: string | null,
    purpose?: "signup" | "google-signin" | null,
    resendAvailableAt?: number | null,
  ) => void;
  clearPendingEmailVerification: () => void;
  clearState: () => void;

  signUp: (
    userName: string,
    password: string,
    email: string,
    firstName: string,
    lastName: string,
  ) => Promise<boolean>;

  signIn: (
    userName: string,
    password: string,
  ) => Promise<"signed_in" | "verify_email" | false>;
  completeGoogleSignIn: (code: string) => Promise<boolean>;
  verifyPendingEmailCode: (
    code: string,
  ) => Promise<"signed_in" | "verified_only" | false>;
  resendPendingEmailCode: () => Promise<boolean>;
  signOut: () => Promise<void>;
  fetchMe: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean) => void;
}

export interface ChatState {
  conversations: Conversation[];
  messages: Record<
    string,
    {
      items: Message[];
      hasMore: boolean;
      nextCursor: string | null | undefined;
    }
  >;

  activeConversationId: string | null;
  replyingTo: Message | null;
  editingMessage: Message | null;

  convoLoading: boolean;
  messageLoading: boolean;
  loading: boolean;
  reset: () => void;

  setActiveConversation: (id: string | null) => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId?: string) => Promise<void>;
  sendDirectMessage: (
    recipientId: string,
    content: string,
    imgUrl?: string,
  ) => Promise<void>;
  sendDirectMessageWithImage: (
    recipientId: string,
    image: File,
    content?: string,
    options?: { onUploadProgress?: (progress: number) => void },
  ) => Promise<void>;
  sendGroupMessage: (
    conversationId: string,
    content: string,
    imgUrl?: string,
  ) => Promise<void>;
  sendGroupMessageWithImage: (
    conversationId: string,
    image: File,
    content?: string,
    options?: { onUploadProgress?: (progress: number) => void },
  ) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessageForMe: (messageId: string) => Promise<void>;
  deleteMessageForEveryone: (messageId: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  addMessage: (message: Message) => Promise<void>;
  updateMessage: (message: Message) => void;
  removeMessageForMe: (conversationId: string, messageId: string) => void;
  setReplyingTo: (message: Message | null) => void;
  setEditingMessage: (message: Message | null) => void;

  updateConversation: (conversation: ConversationPatch) => void;
  setConversationParticipants: (
    conversationId: string,
    participants: Conversation["participants"],
  ) => void;

  markasSeen: (conversationId?: string | null) => Promise<void>;

  addConvo: (convo: Conversation, options?: { activate?: boolean }) => void;
  createConversation: (
    type: "direct" | "group",
    name: string,
    memberIds: string[],
  ) => Promise<void>;
  removeConversationLocal: (conversationId: string) => void;
  deleteOrLeaveGroupConversation: (conversationId?: string) => Promise<void>;
}

export interface SocketState {
  socket: Socket | null;
  onlineUsers: string[];
  showOnlineStatus: boolean;
  connectSocket: () => void;
  loadShowOnlineStatus: () => Promise<void>;
  updateShowOnlineStatus: (value: boolean) => Promise<void>;
  emitShowOnlineStatus: (value: boolean) => void;
  emitActiveConversation: (conversationId: string | null) => void;
  disconnectSocket: () => void;
}

export interface FriendState {
  friends: Friend[];
  loading: boolean;
  receivedList: FriendRequest[];
  sentList: FriendRequest[];
  searchByUserName: (userName: string) => Promise<User | null>;
  addFriend: (to: string, message?: string) => Promise<string>;
  getAllFriendRequests: () => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  getFriends: () => Promise<void>;
}

export interface UserState {
  updateAvatarUrl: (formData: FormData) => Promise<void>;
}

export interface AppNotification {
  id: string;
  type:
    | "friend_request"
    | "new_message"
    | "added_to_group"
    | "conversation_removed"
    | "conversation_deleted";
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  actorName?: string;
  entityId?: string;
  conversationId?: string;
  messageId?: string;
}

export interface NotificationState {
  items: AppNotification[];
  addNotification: (
    notification: Omit<AppNotification, "isRead" | "createdAt"> & {
      isRead?: boolean;
      createdAt?: string;
    },
  ) => void;
  syncFriendRequestNotifications: (requests: FriendRequest[]) => void;
  markConversationNotificationsAsRead: (conversationId: string) => void;
  removeNotificationByEntity: (entityId: string) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  markAllAsRead: () => void;
  unreadCount: () => number;
}
