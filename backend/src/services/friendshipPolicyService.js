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

  if (String(user.role ?? "").toLowerCase() === "admin") {
    return true;
  }

  return PROTECTED_ACCOUNT_USERNAMES.has(normalizeUserName(user.userName));
};

export const isEligibleForFriendship = (user) =>
  Boolean(user) &&
  !isProtectedAccount(user) &&
  String(user.status ?? "").toLowerCase() === ACTIVE_USER_STATUS;

export const getFriendshipDiscoveryUserFilter = () => ({
  role: { $ne: "admin" },
  status: ACTIVE_USER_STATUS,
  userName: { $nin: Array.from(PROTECTED_ACCOUNT_USERNAMES) },
});

export const getProtectedFriendshipMessage = () =>
  "Không thể kết bạn với tài khoản quản trị.";
