import {
  APP_PERMISSIONS,
  canManageUser,
  hasPermission,
  type AppPermission,
} from "@/shared/lib/rbac";

type AdminAccessUser = Parameters<typeof hasPermission>[0];

export const canViewAdminRoute = (
  user: AdminAccessUser,
  permission: AppPermission,
) => hasPermission(user, permission);

export const getAdminUserCapabilities = (user: AdminAccessUser) => ({
  canAssignRole: hasPermission(user, APP_PERMISSIONS.ROLE_ASSIGN),
  canDeleteUser: hasPermission(user, APP_PERMISSIONS.USER_DELETE),
  canToggleUserStatus:
    hasPermission(user, APP_PERMISSIONS.USER_LOCK) ||
    hasPermission(user, APP_PERMISSIONS.USER_UNLOCK),
});

export { APP_PERMISSIONS, canManageUser, hasPermission };
