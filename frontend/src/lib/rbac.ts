export const APP_ROLES = {
  USER: "USER",
  SUPPORT: "SUPPORT",
  MODERATOR: "MODERATOR",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export const APP_PERMISSIONS = {
  DASHBOARD_VIEW: "DASHBOARD_VIEW",
  USER_VIEW: "USER_VIEW",
  USER_LOCK: "USER_LOCK",
  USER_UNLOCK: "USER_UNLOCK",
  USER_DELETE: "USER_DELETE",
  ROLE_VIEW: "ROLE_VIEW",
  ROLE_ASSIGN: "ROLE_ASSIGN",
  PERMISSION_VIEW: "PERMISSION_VIEW",
  REPORT_VIEW: "REPORT_VIEW",
  REPORT_HANDLE: "REPORT_HANDLE",
  SUPPORT_VIEW: "SUPPORT_VIEW",
  SUPPORT_REPLY: "SUPPORT_REPLY",
  MAINTENANCE_TOGGLE: "MAINTENANCE_TOGGLE",
  AUDIT_LOG_VIEW: "AUDIT_LOG_VIEW",
} as const;

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];
export type AppPermission = (typeof APP_PERMISSIONS)[keyof typeof APP_PERMISSIONS];

const ROLE_PRIORITY: AppRole[] = [
  APP_ROLES.SUPER_ADMIN,
  APP_ROLES.ADMIN,
  APP_ROLES.MODERATOR,
  APP_ROLES.SUPPORT,
  APP_ROLES.USER,
];

const LEGACY_TO_APP_ROLE: Record<string, AppRole> = {
  user: APP_ROLES.USER,
  admin: APP_ROLES.ADMIN,
  support: APP_ROLES.SUPPORT,
  moderator: APP_ROLES.MODERATOR,
  super_admin: APP_ROLES.SUPER_ADMIN,
};

type AccessLike = {
  roles?: unknown[];
  primaryRole?: unknown;
  role?: unknown;
  permissions?: string[];
};

export const normalizeRoles = (user?: AccessLike | null): AppRole[] => {
  const fromArray = Array.isArray(user?.roles)
    ? user.roles
        .map((role) => String(role ?? "").trim().toUpperCase())
        .filter((role): role is AppRole => ROLE_PRIORITY.includes(role as AppRole))
    : [];

  if (fromArray.length > 0) {
    return [...new Set(fromArray)].sort(
      (left, right) => ROLE_PRIORITY.indexOf(left) - ROLE_PRIORITY.indexOf(right),
    );
  }

  const legacyRole = String(user?.primaryRole ?? user?.role ?? "user").trim().toLowerCase();
  return [LEGACY_TO_APP_ROLE[legacyRole] ?? APP_ROLES.USER];
};

export const getPrimaryRole = (user?: AccessLike | null): AppRole =>
  normalizeRoles(user)[0] ?? APP_ROLES.USER;

export const hasPermission = (user: AccessLike | null | undefined, permission: AppPermission) =>
  Array.isArray(user?.permissions) && user.permissions.includes(permission);

export const hasAnyPermission = (
  user: AccessLike | null | undefined,
  permissions: AppPermission[],
) => permissions.some((permission) => hasPermission(user, permission));

export const hasAdminPanelAccess = (user?: AccessLike | null) =>
  normalizeRoles(user).some((role) => role !== APP_ROLES.USER);

export const getRoleLabel = (role: AppRole) =>
  ({
    [APP_ROLES.USER]: "Người dùng",
    [APP_ROLES.SUPPORT]: "Hỗ trợ",
    [APP_ROLES.MODERATOR]: "Kiểm duyệt",
    [APP_ROLES.ADMIN]: "Admin",
    [APP_ROLES.SUPER_ADMIN]: "Super Admin",
  })[role];

export const getRoleBadgeClassName = (role: AppRole) =>
  ({
    [APP_ROLES.USER]: "border-sky-500/20 bg-sky-500/10 text-sky-700",
    [APP_ROLES.SUPPORT]: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
    [APP_ROLES.MODERATOR]: "border-violet-500/20 bg-violet-500/10 text-violet-700",
    [APP_ROLES.ADMIN]: "border-amber-500/20 bg-amber-500/10 text-amber-700",
    [APP_ROLES.SUPER_ADMIN]: "border-rose-500/20 bg-rose-500/10 text-rose-700",
  })[role];
