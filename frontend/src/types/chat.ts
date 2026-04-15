export interface Participant {
  userId?:
    | string
    | { _id: string; displayName?: string; avatarUrl?: string | null };
  _id?: string;
  displayName?: string;
  avatarUrl?: string | null;
  joinedAt?: string;
}

export interface SeenUser {
  _id: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface Group {
  name: string;
  createdBy: string;
}

export interface LastMessage {
  _id: string;
  content: string | null;
  imgUrl?: string | null;
  createdAt?: string;
  sender?: {
    _id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  senderId?: string;
}

export interface Conversation {
  _id: string;
  type: "direct" | "group";
  group: Group;
  participants: Participant[];
  lastMessageAt: string;
  seenBy: SeenUser[];
  lastMessage: LastMessage | null;
  unreadCounts: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationResponse {
  conversations: Conversation[];
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  type?: "user" | "system";
  content: string | null;
  imgUrl?: string | null;
  updatedAt?: string | null;
  createdAt: string;
  isOwn?: boolean;
}
