import { APP_PERMISSIONS, APP_ROLES, ROLE_PERMISSION_MAP, ROLE_PRIORITY } from "../constants/rbac.js";

const VALID_ROLES = new Set(Object.values(APP_ROLES));
const VALID_PERMISSIONS = new Set(Object.values(APP_PERMISSIONS));

const LEGACY_ROLE_TO_APP_ROLE = {
  user: APP_ROLES.USER,
  support: APP_ROLES.SUPPORT,
  moderator: APP_ROLES.MODERATOR,
  admin: APP_ROLES.SUPER_ADMIN,
  super_admin: APP_ROLES.SUPER_ADMIN,
};

export const normalizeRoles = (userLike) => {
  const rawRoles = Array.isArray(userLike?.roles) ? userLike.roles : [];
  const normalizedFromArray = rawRoles
    .map((role) => String(role ?? "").trim().toUpperCase())
    .filter((role) => VALID_ROLES.has(role));

  if (normalizedFromArray.length > 0) {
    return [...new Set(normalizedFromArray)].sort(
      (left, right) => ROLE_PRIORITY.indexOf(left) - ROLE_PRIORITY.indexOf(right),
    );
  }

  const legacyRole = String(userLike?.role ?? "user").trim().toLowerCase();
  const mappedRole = LEGACY_ROLE_TO_APP_ROLE[legacyRole] ?? APP_ROLES.USER;
  return [mappedRole];
};

export const getPrimaryRole = (userLike) => normalizeRoles(userLike)[0] ?? APP_ROLES.USER;

export const getLegacyRole = (userLike) =>
  hasAdminPanelAccess(userLike) ? "admin" : "user";

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
  const roles = normalizeRoles(userLike);
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

export const hasRole = (userLike, role) => normalizeRoles(userLike).includes(role);

export const hasAdminPanelAccess = (userLike) =>
  normalizeRoles(userLike).some((role) => role !== APP_ROLES.USER);

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
  const roles = normalizeRoles(userLike);
  const primaryRole = roles[0] ?? APP_ROLES.USER;
  const permissions = getPermissionsForUser(userLike);

  return {
    ...userLike,
    role: getLegacyRole({ ...userLike, roles }),
    roles,
    primaryRole,
    permissions,
  };
};

export const buildAdminStaffQuery = () => ({
  $or: [
    { roles: { $exists: true, $not: { $size: 0 } } },
    { role: { $in: ["admin", "support", "moderator", "super_admin"] } },
  ],
});

export const buildSuperAdminQuery = () => ({
  $or: [
    { roles: APP_ROLES.SUPER_ADMIN },
    {
      $and: [
        {
          $or: [{ roles: { $exists: false } }, { roles: { $size: 0 } }],
        },
        { role: { $in: ["admin", "super_admin"] } },
      ],
    },
  ],
});
