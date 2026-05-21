export interface Participant {
  userId?:
    | string
    | {
        _id: string;
        userName?: string;
        displayName?: string;
        avatarUrl?: string | null;
        bio?: string | null;
        phone?: string | null;
        email?: string;
      };
  _id?: string;
  userName?: string;
  displayName?: string;
  avatarUrl?: string | null;
  bio?: string | null;
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
  avatarUrl?: string | null;
}

export type SupportStatus = "open" | "in_progress" | "resolved" | "closed";

export interface SupportProfile {
  _id: string;
  userName?: string;
  displayName?: string;
  avatarUrl?: string | null;
  email?: string;
  role?: string;
}

export interface LastMessage {
  _id: string;
  content: string | null;
  imgUrl?: string | null;
  isDeletedForEveryone?: boolean;
  createdAt?: string;
  senderDeleted?: boolean;
  senderDisplayName?: string | null;
  senderAvatar?: string | null;
  sender?: {
    _id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  senderId?: string | { _id?: string } | null;
}

export interface DirectBlockInfo {
  blockedByMe: boolean;
  blockedByOther: boolean;
  blockerId?: string | null;
  blockedUserId?: string | null;
  canSendMessage: boolean;
}

export interface MessageReply {
  messageId: string;
  senderId: string | null;
  senderDeleted?: boolean;
  senderDisplayName?: string | null;
  senderAvatar?: string | null;
  content: string | null;
  imgUrl?: string | null;
  isDeletedForEveryone?: boolean;
  type?: "user" | "system";
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface Conversation {
  _id: string;
  type: "direct" | "group" | "support";
  group?: Group | null;
  participants: Participant[];
  blockInfo?: DirectBlockInfo;
  supportStatus?: SupportStatus;
  supportCreatedByUserId?: string;
  supportCreatedByUser?: SupportProfile | null;
  assignedAdminId?: string | null;
  assignedAdmin?: SupportProfile | null;
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
  senderId: string | null;
  senderDeleted?: boolean;
  senderDisplayName?: string | null;
  senderAvatar?: string | null;
  type?: "user" | "system";
  content: string | null;
  imgUrl?: string | null;
  replyTo?: MessageReply | null;
  reactions?: MessageReaction[];
  callMetadata?: {
    callSessionId?: string | null;
    callType?: "voice" | "video";
    callMode?: "direct" | "group";
    callStatus?: "ringing" | "active" | "accepted" | "rejected" | "missed" | "cancelled" | "ended" | "failed" | null;
    callDurationSeconds?: number;
    durationSeconds?: number;
    participantCount?: number;
    initiatorId?: string | null;
    callerId?: string | null;
    receiverId?: string | null;
  } | null;
  deletedFor?: string[];
  isDeletedForEveryone?: boolean;
  isHiddenForMe?: boolean;
  editedAt?: string | null;
  updatedAt?: string | null;
  createdAt: string;
  isOwn?: boolean;
}
