import {
  APP_PERMISSIONS,
  APP_ROLES,
  ROLE_LABEL_MAP,
  ROLE_LEVEL_MAP,
  ROLE_PERMISSION_MAP,
  ROLE_PRIORITY,
} from "../constants/rbac.js";

const VALID_ROLES = new Set(Object.values(APP_ROLES));
const VALID_PERMISSIONS = new Set(Object.values(APP_PERMISSIONS));

const LEGACY_ROLE_TO_APP_ROLE = {
  user: APP_ROLES.USER,
  support: APP_ROLES.SUPPORT,
  moderator: APP_ROLES.MODERATOR,
  admin: APP_ROLES.ADMIN,
  super_admin: APP_ROLES.SUPER_ADMIN,
};

export const normalizeRole = (userLike) => {
  const canonicalRole = String(userLike?.role ?? "")
    .trim()
    .toUpperCase();
  if (VALID_ROLES.has(canonicalRole)) {
    return canonicalRole;
  }

  const fallbackRole = Array.isArray(userLike?.roles)
    ? userLike.roles
        .map((role) => String(role ?? "").trim().toUpperCase())
        .find((role) => VALID_ROLES.has(role))
    : null;
  if (fallbackRole) {
    return fallbackRole;
  }

  if (userLike?.isSuperAdmin === true) {
    return APP_ROLES.SUPER_ADMIN;
  }

  if (userLike?.isAdmin === true) {
    return APP_ROLES.ADMIN;
  }

  if (userLike?.isModerator === true) {
    return APP_ROLES.MODERATOR;
  }

  if (userLike?.isSupport === true) {
    return APP_ROLES.SUPPORT;
  }

  const legacyRole = String(userLike?.primaryRole ?? userLike?.role ?? "user")
    .trim()
    .toLowerCase();
  return LEGACY_ROLE_TO_APP_ROLE[legacyRole] ?? APP_ROLES.USER;
};

export const normalizeRoles = (userLike) => [normalizeRole(userLike)];

export const getPrimaryRole = (userLike) => normalizeRole(userLike);

export const getRoleLevel = (roleOrUser) =>
  ROLE_LEVEL_MAP[
    typeof roleOrUser === "string" ? normalizeRole({ role: roleOrUser }) : normalizeRole(roleOrUser)
  ] ?? ROLE_LEVEL_MAP[APP_ROLES.USER];

export const getRoleLabel = (roleOrUser) =>
  ROLE_LABEL_MAP[
    typeof roleOrUser === "string" ? normalizeRole({ role: roleOrUser }) : normalizeRole(roleOrUser)
  ] ?? ROLE_LABEL_MAP[APP_ROLES.USER];

export const getPermissionsForRoles = (roles = []) => {
  const permissionSet = new Set();

  roles.forEach((role) => {
    (ROLE_PERMISSION_MAP[role] ?? []).forEach((permission) => {
      permissionSet.add(permission);
    });
  });

  return [...permissionSet];
};

export const getPermissionsForUser = (userLike) => {
  const roles = [normalizeRole(userLike)];
  const explicitPermissions = Array.isArray(userLike?.permissions)
    ? userLike.permissions
        .map((permission) => String(permission ?? "").trim().toUpperCase())
        .filter((permission) => VALID_PERMISSIONS.has(permission))
    : [];

  return [...new Set([...getPermissionsForRoles(roles), ...explicitPermissions])];
};

export const hasPermission = (userLike, permission) =>
  getPermissionsForUser(userLike).includes(permission);

export const hasAnyPermission = (userLike, permissions = []) =>
  permissions.some((permission) => hasPermission(userLike, permission));

export const hasRole = (userLike, role) => normalizeRole(userLike) === role;

export const hasAdminPanelAccess = (userLike) =>
  normalizeRole(userLike) !== APP_ROLES.USER;

export const getAssignableRoles = (actorLike) => {
  if (hasRole(actorLike, APP_ROLES.SUPER_ADMIN)) {
    return [
      APP_ROLES.USER,
      APP_ROLES.SUPPORT,
      APP_ROLES.MODERATOR,
      APP_ROLES.ADMIN,
      APP_ROLES.SUPER_ADMIN,
    ];
  }

  if (hasPermission(actorLike, APP_PERMISSIONS.ROLE_ASSIGN)) {
    return [APP_ROLES.USER, APP_ROLES.SUPPORT, APP_ROLES.MODERATOR];
  }

  return [];
};

export const serializeUserAccess = (userLike = {}) => {
  const role = normalizeRole(userLike);
  const permissions = getPermissionsForUser(userLike);

  return {
    ...userLike,
    role,
    roleLabel: getRoleLabel(role),
    roleLevel: getRoleLevel(role),
    roles: [role],
    primaryRole: role,
    permissions,
  };
};

export const buildAdminStaffQuery = () => ({
  role: {
    $in: ROLE_PRIORITY.filter((role) => role !== APP_ROLES.USER),
  },
});

export const buildSuperAdminQuery = () => ({
  role: APP_ROLES.SUPER_ADMIN,
});
