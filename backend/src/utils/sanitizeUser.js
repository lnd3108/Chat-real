import { serializeUserAccess } from "../services/rbacService.js";

const toPlainObject = (value) =>
  value && typeof value.toObject === "function" ? value.toObject() : value;

export const sanitizeUser = (userLike) => {
  if (!userLike) {
    return null;
  }

  const user = serializeUserAccess(toPlainObject(userLike));

  return {
    _id: user._id,
    userName: user.userName,
    displayName: user.displayName,
    email: user.email ?? null,
    avatarUrl: user.avatarUrl ?? null,
    authProvider: user.authProvider,
    emailVerified: user.emailVerified,
    phone: user.phone ?? null,
    bio: user.bio ?? null,
    role: user.role,
    roleLabel: user.roleLabel,
    roleLevel: user.roleLevel,
    permissions: user.permissions,
    status: user.status,
    createdAt: user.createdAt ?? null,
    updatedAt: user.updatedAt ?? null,
  };
};

export const sanitizeAuthResponse = (userLike) => sanitizeUser(userLike);

export const sanitizeAdminUser = (userLike) => sanitizeUser(userLike);
