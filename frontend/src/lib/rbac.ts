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

export const ROLE_PRIORITY: AppRole[] = [
  APP_ROLES.SUPER_ADMIN,
  APP_ROLES.ADMIN,
  APP_ROLES.MODERATOR,
  APP_ROLES.SUPPORT,
  APP_ROLES.USER,
];

export const ROLE_LEVEL_MAP: Record<AppRole, number> = {
  [APP_ROLES.USER]: 20,
  [APP_ROLES.SUPPORT]: 40,
  [APP_ROLES.MODERATOR]: 60,
  [APP_ROLES.ADMIN]: 80,
  [APP_ROLES.SUPER_ADMIN]: 100,
};

export const ROLE_LABEL_MAP: Record<AppRole, string> = {
  [APP_ROLES.USER]: "Người dùng",
  [APP_ROLES.SUPPORT]: "Hỗ trợ",
  [APP_ROLES.MODERATOR]: "Kiểm duyệt",
  [APP_ROLES.ADMIN]: "Admin",
  [APP_ROLES.SUPER_ADMIN]: "Super Admin",
};

export const ROLE_BADGE_CLASS_MAP: Record<AppRole, string> = {
  [APP_ROLES.USER]: "border-sky-500/20 bg-sky-500/10 text-sky-700",
  [APP_ROLES.SUPPORT]: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
  [APP_ROLES.MODERATOR]: "border-violet-500/20 bg-violet-500/10 text-violet-700",
  [APP_ROLES.ADMIN]: "border-amber-500/20 bg-amber-500/10 text-amber-700",
  [APP_ROLES.SUPER_ADMIN]: "border-rose-500/20 bg-rose-500/10 text-rose-700",
};

export const ROLE_PERMISSION_MAP: Record<AppRole, AppPermission[]> = {
  [APP_ROLES.USER]: [],
  [APP_ROLES.SUPPORT]: [
    APP_PERMISSIONS.SUPPORT_VIEW,
    APP_PERMISSIONS.SUPPORT_REPLY,
  ],
  [APP_ROLES.MODERATOR]: [
    APP_PERMISSIONS.USER_VIEW,
    APP_PERMISSIONS.REPORT_VIEW,
    APP_PERMISSIONS.REPORT_HANDLE,
  ],
  [APP_ROLES.ADMIN]: [
    APP_PERMISSIONS.DASHBOARD_VIEW,
    APP_PERMISSIONS.USER_VIEW,
    APP_PERMISSIONS.USER_LOCK,
    APP_PERMISSIONS.USER_UNLOCK,
    APP_PERMISSIONS.USER_DELETE,
    APP_PERMISSIONS.ROLE_VIEW,
    APP_PERMISSIONS.ROLE_ASSIGN,
    APP_PERMISSIONS.PERMISSION_VIEW,
    APP_PERMISSIONS.REPORT_VIEW,
    APP_PERMISSIONS.REPORT_HANDLE,
    APP_PERMISSIONS.SUPPORT_VIEW,
    APP_PERMISSIONS.SUPPORT_REPLY,
    APP_PERMISSIONS.MAINTENANCE_TOGGLE,
    APP_PERMISSIONS.AUDIT_LOG_VIEW,
  ],
  [APP_ROLES.SUPER_ADMIN]: Object.values(APP_PERMISSIONS),
};

const LEGACY_TO_APP_ROLE: Record<string, AppRole> = {
  user: APP_ROLES.USER,
  support: APP_ROLES.SUPPORT,
  moderator: APP_ROLES.MODERATOR,
  admin: APP_ROLES.ADMIN,
  super_admin: APP_ROLES.SUPER_ADMIN,
};

type AccessLike = {
  role?: unknown;
  primaryRole?: unknown;
  roles?: unknown[];
  permissions?: string[];
};

export const normalizeRole = (user?: AccessLike | null): AppRole => {
  const canonicalRole = String(user?.role ?? "")
    .trim()
    .toUpperCase();
  if (ROLE_PRIORITY.includes(canonicalRole as AppRole)) {
    return canonicalRole as AppRole;
  }

  const firstArrayRole = Array.isArray(user?.roles)
    ? user.roles
        .map((role) => String(role ?? "").trim().toUpperCase())
        .find((role) => ROLE_PRIORITY.includes(role as AppRole))
    : null;
  if (firstArrayRole) {
    return firstArrayRole as AppRole;
  }

  const fallbackRole = String(user?.primaryRole ?? user?.role ?? "user")
    .trim()
    .toLowerCase();
  return LEGACY_TO_APP_ROLE[fallbackRole] ?? APP_ROLES.USER;
};

export const normalizeRoles = (user?: AccessLike | null): AppRole[] => [normalizeRole(user)];

export const getPrimaryRole = (user?: AccessLike | null): AppRole => normalizeRole(user);

export const getRoleLabel = (role: AppRole) => ROLE_LABEL_MAP[role];

export const getRoleLevel = (role: AppRole) => ROLE_LEVEL_MAP[role];

export const getRoleBadgeClassName = (role: AppRole) => ROLE_BADGE_CLASS_MAP[role];

export const getPermissionsForUser = (
  user: AccessLike | null | undefined,
): AppPermission[] => {
  const rolePermissions = ROLE_PERMISSION_MAP[normalizeRole(user)] ?? [];
  const explicitPermissions = Array.isArray(user?.permissions)
    ? user.permissions.filter((permission): permission is AppPermission =>
        Object.values(APP_PERMISSIONS).includes(permission as AppPermission),
      )
    : [];

  return [...new Set([...rolePermissions, ...explicitPermissions])];
};

export const hasPermission = (user: AccessLike | null | undefined, permission: AppPermission) =>
  getPermissionsForUser(user).includes(permission);

export const hasAnyPermission = (
  user: AccessLike | null | undefined,
  permissions: AppPermission[],
) => permissions.some((permission) => hasPermission(user, permission));

export const hasAdminPanelAccess = (user?: AccessLike | null) =>
  normalizeRole(user) !== APP_ROLES.USER;

export const canManageUser = (
  currentUser: AccessLike | null | undefined,
  targetUser: AccessLike | null | undefined,
) => {
  const currentRole = normalizeRole(currentUser);
  const targetRole = normalizeRole(targetUser);
  return getRoleLevel(currentRole) > getRoleLevel(targetRole);
};
