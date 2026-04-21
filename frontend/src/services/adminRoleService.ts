import { axiosInstance } from "@/lib/axios";
import type { AppRole } from "@/lib/rbac";

export const adminRoleService = {
  getRoles: async () => {
    const response = await axiosInstance.get("/admin/roles");
    return response.data.data as {
      roles: Array<{
        key: AppRole;
        label: string;
        permissions: string[];
        assignable: boolean;
      }>;
      assignableRoles: AppRole[];
    };
  },

  getUserPermissions: async (userId: string) => {
    const response = await axiosInstance.get(`/admin/users/${userId}/permissions`);
    return response.data.data.user;
  },

  updateUserRole: async (userId: string, payload: { role: AppRole; reason: string }) => {
    const response = await axiosInstance.patch(`/admin/users/${userId}/roles`, payload);
    return response.data.data as {
      user: {
        _id: string;
        displayName: string;
        userName: string;
        email: string;
        avatarUrl?: string | null;
        role: "user" | "admin";
        roles: AppRole[];
        primaryRole: AppRole;
        permissions: string[];
        status: "active" | "inactive" | "suspended" | "banned";
        createdAt: string;
        updatedAt?: string;
      };
      audit: {
        action: string;
        reason: string;
        oldRoles: AppRole[];
        newRoles: AppRole[];
      };
    };
  },

  getAuditLogs: async (params: Record<string, string | number | undefined>) => {
    const response = await axiosInstance.get("/admin/audit-logs", { params });
    return response.data.data as {
      logs: Array<{
        _id: string;
        action: string;
        reason?: string | null;
        actorRoles: AppRole[];
        beforeData?: { roles?: AppRole[] };
        afterData?: { roles?: AppRole[] };
        createdAt: string;
        actor?: {
          _id: string;
          displayName: string;
          userName: string;
        } | null;
        targetUser?: {
          _id: string;
          displayName: string;
          userName: string;
        } | null;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    };
  },
};
