import User from "../models/User.js";
import { ADMIN_SOCKET_EVENTS, USER_SOCKET_EVENTS } from "../constants/socketEvents.js";
import { emitToAdmins } from "../socket/adminSocket.js";
import { emitToUser } from "../socket/index.js";
import {
  APP_PERMISSIONS,
  APP_ROLES,
  ROLE_LABEL_MAP,
  ROLE_PERMISSION_MAP,
} from "../constants/rbac.js";
import {
  buildSuperAdminQuery,
  getAssignableRoles,
  hasPermission,
  hasRole,
  normalizeRole,
  serializeUserAccess,
} from "./rbacService.js";
import { AUDIT_ACTIONS, createAuditLog, listAuditLogs } from "./auditLogService.js";

const VALID_ASSIGNABLE_ROLES = new Set(Object.values(APP_ROLES));

export const getRoleDefinitionsForActor = (actorLike) => {
  const assignableRoles = getAssignableRoles(actorLike);

  return Object.values(APP_ROLES).map((role) => ({
    key: role,
    label: ROLE_LABEL_MAP[role] ?? role,
    permissions:
      role === APP_ROLES.SUPER_ADMIN
        ? Object.values(APP_PERMISSIONS)
        : (ROLE_PERMISSION_MAP[role] ?? []),
    assignable: assignableRoles.includes(role),
  }));
};

export const getPermissionSnapshotForUser = (userLike) => {
  const enriched = serializeUserAccess(userLike);
  return {
    userId: userLike?._id?.toString?.() ?? null,
    role: enriched.role,
    roleLabel: enriched.roleLabel,
    roleLevel: enriched.roleLevel,
    permissions: enriched.permissions,
    hasAdminAccess: enriched.role !== APP_ROLES.USER,
  };
};

const ensureRoleAssignmentAllowed = async ({ actor, targetUser, nextRole }) => {
  if (!hasPermission(actor, APP_PERMISSIONS.ROLE_ASSIGN)) {
    const error = new Error("Bạn không có quyền phân quyền tài khoản.");
    error.status = 403;
    throw error;
  }

  if (String(actor._id) === String(targetUser._id)) {
    const error = new Error("Không thể tự cập nhật quyền của chính mình.");
    error.status = 400;
    throw error;
  }

  if (!VALID_ASSIGNABLE_ROLES.has(nextRole)) {
    const error = new Error("Role không hợp lệ.");
    error.status = 400;
    throw error;
  }

  const actorIsSuperAdmin = hasRole(actor, APP_ROLES.SUPER_ADMIN);
  const targetRole = normalizeRole(targetUser);

  if (!actorIsSuperAdmin && [APP_ROLES.ADMIN, APP_ROLES.SUPER_ADMIN].includes(nextRole)) {
    const error = new Error("Chỉ SUPER_ADMIN mới được gán vai trò ADMIN hoặc SUPER_ADMIN.");
    error.status = 403;
    throw error;
  }

  if (!actorIsSuperAdmin && targetRole === APP_ROLES.SUPER_ADMIN) {
    const error = new Error("ADMIN không được thay đổi quyền của SUPER_ADMIN.");
    error.status = 403;
    throw error;
  }

  const assignableRoles = getAssignableRoles(actor);
  if (!assignableRoles.includes(nextRole)) {
    const error = new Error("Bạn không được phép gán role này.");
    error.status = 403;
    throw error;
  }

  if (targetRole === APP_ROLES.SUPER_ADMIN && nextRole !== APP_ROLES.SUPER_ADMIN) {
    const totalSuperAdmins = await User.countDocuments(buildSuperAdminQuery());

    if (totalSuperAdmins <= 1) {
      const error = new Error("Hệ thống phải luôn có ít nhất một SUPER_ADMIN.");
      error.status = 400;
      throw error;
    }
  }
};

export const updateUserRoleByAdmin = async ({ actor, targetUserId, nextRole, reason }) => {
  const normalizedRole = String(nextRole ?? "").trim().toUpperCase();
  const trimmedReason = String(reason ?? "").trim();

  if (!trimmedReason) {
    const error = new Error("Vui lòng nhập lý do thay đổi quyền.");
    error.status = 400;
    throw error;
  }

  const targetUser = await User.findById(targetUserId).select(
    "displayName userName email avatarUrl role permissions status isSystemAccount createdAt updatedAt",
  );

  if (!targetUser) {
    const error = new Error("Không tìm thấy người dùng cần phân quyền.");
    error.status = 404;
    throw error;
  }

  if (targetUser.isSystemAccount) {
    const error = new Error("Không thể thay đổi quyền của tài khoản hệ thống.");
    error.status = 400;
    throw error;
  }

  await ensureRoleAssignmentAllowed({
    actor,
    targetUser,
    nextRole: normalizedRole,
  });

  const beforeSnapshot = serializeUserAccess(targetUser.toObject());

  if (beforeSnapshot.role === normalizedRole) {
    const error = new Error("Tài khoản này đã có role được chọn.");
    error.status = 400;
    throw error;
  }

  const updatedUser = await User.findByIdAndUpdate(
    targetUserId,
    {
      $set: {
        role: normalizedRole,
        roles: [normalizedRole],
      },
    },
    { new: true },
  ).select(
    "displayName userName email avatarUrl role permissions status isSystemAccount createdAt updatedAt",
  );

  const afterSnapshot = serializeUserAccess(updatedUser.toObject());

  await createAuditLog({
    actorId: actor._id,
    actorRoles: [normalizeRole(actor)],
    targetUserId: updatedUser._id,
    action: AUDIT_ACTIONS.USER_ROLE_UPDATED,
    beforeData: {
      role: beforeSnapshot.role,
      roleLabel: beforeSnapshot.roleLabel,
      roleLevel: beforeSnapshot.roleLevel,
    },
    afterData: {
      role: afterSnapshot.role,
      roleLabel: afterSnapshot.roleLabel,
      roleLevel: afterSnapshot.roleLevel,
    },
    reason: trimmedReason,
    metadata: {
      oldRole: beforeSnapshot.role,
      newRole: afterSnapshot.role,
    },
  });

  const payload = {
    userId: updatedUser._id.toString(),
    oldRole: beforeSnapshot.role,
    newRole: afterSnapshot.role,
    oldRoles: [beforeSnapshot.role],
    newRoles: [afterSnapshot.role],
    updatedBy: {
      _id: actor._id?.toString?.() ?? actor._id,
      displayName: actor.displayName ?? null,
      userName: actor.userName ?? null,
    },
    updatedAt: new Date().toISOString(),
    reason: trimmedReason,
    user: {
      _id: updatedUser._id.toString(),
      displayName: updatedUser.displayName,
      userName: updatedUser.userName,
      email: updatedUser.email,
      avatarUrl: updatedUser.avatarUrl ?? null,
      role: afterSnapshot.role,
      roleLabel: afterSnapshot.roleLabel,
      roleLevel: afterSnapshot.roleLevel,
      permissions: afterSnapshot.permissions,
      status: updatedUser.status,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    },
  };

  emitToAdmins(ADMIN_SOCKET_EVENTS.USER_ROLE_UPDATED, payload);
  emitToUser(updatedUser._id, USER_SOCKET_EVENTS.ROLE_UPDATED, payload);

  return {
    user: payload.user,
    audit: {
      action: AUDIT_ACTIONS.USER_ROLE_UPDATED,
      reason: trimmedReason,
      oldRole: beforeSnapshot.role,
      newRole: afterSnapshot.role,
      oldRoles: [beforeSnapshot.role],
      newRoles: [afterSnapshot.role],
    },
  };
};

export { listAuditLogs };
