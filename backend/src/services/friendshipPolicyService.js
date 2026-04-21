import { APP_ROLES } from "../constants/rbac.js";
import { normalizeRoles } from "./rbacService.js";

const PROTECTED_ACCOUNT_USERNAMES = new Set([
  "admin",
  "super_admin",
  "superadmin",
  "system",
  "support",
]);

const ACTIVE_USER_STATUS = "active";

const normalizeUserName = (value) => String(value ?? "").trim().toLowerCase();

export const isProtectedAccount = (user) => {
  if (!user) {
    return false;
  }

  const roles = normalizeRoles(user);
  if (roles.some((role) => role !== APP_ROLES.USER)) {
    return true;
  }

  if (Boolean(user.isSystemAccount)) {
    return true;
  }

  return PROTECTED_ACCOUNT_USERNAMES.has(normalizeUserName(user.userName));
};

export const isEligibleForFriendship = (user) =>
  Boolean(user) &&
  !isProtectedAccount(user) &&
  String(user.status ?? "").toLowerCase() === ACTIVE_USER_STATUS;

export const getFriendshipDiscoveryUserFilter = () => {
  const protectedUserNames = Array.from(PROTECTED_ACCOUNT_USERNAMES).join("|");
  return {
    role: APP_ROLES.USER,
    isSystemAccount: { $ne: true },
    status: ACTIVE_USER_STATUS,
    userName: {
      $not: {
        $regex: `^(${protectedUserNames})$`,
        $options: "i",
      },
    },
  };
};

export const getProtectedFriendshipMessage = () =>
  "Không thể kết bạn với tài khoản quản trị.";
