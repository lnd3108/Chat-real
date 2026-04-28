import type { AppRole } from "@/shared/lib/rbac";

export type PaginationData = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type AdminUserStatus = "active" | "inactive" | "suspended" | "banned";
export type AdminReportStatus = "pending" | "reviewing" | "resolved" | "rejected";
export type AdminReportTargetType = "user" | "message" | "conversation";
export type AdminSupportStatus = "open" | "in_progress" | "resolved" | "closed";

export interface AdminUserRecord {
  _id: string;
  displayName: string;
  userName: string;
  email: string;
  role: AppRole;
  roleLabel?: string;
  roleLevel?: number;
  permissions?: string[];
  status: AdminUserStatus;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt?: string;
  isSystemAccount?: boolean;
  isOnline?: boolean;
}

export interface AdminReportRecord {
  _id: string;
  reporterSnapshot: {
    _id: string;
    displayName: string;
    userName: string;
    avatarUrl?: string;
  };
  targetType: AdminReportTargetType;
  reason: string;
  status: AdminReportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSupportConversationRecord {
  _id: string;
  supportStatus: AdminSupportStatus;
  supportCreatedByUserId: string;
  supportCreatedByUser?: {
    _id: string;
    displayName: string;
    userName: string;
    email?: string;
    avatarUrl?: string;
  };
  assignedAdminId?: string | null;
  assignedAdmin?: {
    _id: string;
    displayName: string;
  } | null;
  lastMessage?: {
    _id?: string;
    content?: string;
    senderDisplayName?: string;
    createdAt?: string;
  };
  unreadCounts?: Record<string, number>;
  updatedAt: string;
  createdAt: string;
}

export interface AdminSupportMessageRecord {
  _id: string;
  conversationId: string;
  senderId: string;
  senderDisplayName?: string;
  senderAvatar?: string | null;
  content: string;
  createdAt: string;
  type?: string;
}

export interface AdminSystemNotificationPayload {
  id?: string;
  type?: string;
  title?: string;
  message?: string;
  link?: string;
  entityId?: string | null;
  actor?: unknown;
  severity?: "info" | "warning" | "success" | "error";
  metadata?: Record<string, unknown>;
}

export interface AdminUserRealtimePayload {
  userId?: string;
  user?: AdminUserRecord;
  oldRole?: AppRole;
  newRole?: AppRole;
  oldRoles?: AppRole[];
  newRoles?: AppRole[];
  reason?: string;
  updatedAt?: string;
  updatedBy?: {
    _id?: string;
    displayName?: string;
    userName?: string;
  };
  isOnline?: boolean;
  status?: string;
  actor?: unknown;
}

export interface AdminReportRealtimePayload {
  report?: AdminReportRecord;
}

export interface AdminSupportRealtimePayload {
  conversationId?: string;
  conversation?: AdminSupportConversationRecord;
  message?: AdminSupportMessageRecord;
  actor?: unknown;
}

export interface AdminMaintenanceRealtimePayload {
  message?: string;
  enabledAt?: string;
  disabledAt?: string;
  createdAt?: string;
  actor?: unknown;
}
