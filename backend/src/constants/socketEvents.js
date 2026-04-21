export const SOCKET_ROOMS = {
  ADMINS: "admins",
};

export const USER_SOCKET_EVENTS = {
  REGISTER: "user:register",
  LOGIN: "user:login",
  LOGOUT: "user:logout",
  ONLINE: "user:online",
  OFFLINE: "user:offline",
  STATUS_CHANGED: "user:status-changed",
  ACCOUNT_LOCKED: "user:account-locked",
  ACCOUNT_UNLOCKED: "user:account-unlocked",
  ROLE_UPDATED: "user:role-updated",
  ACCOUNT_DELETED: "account:deleted",
  ACCOUNT_BANNED_LEGACY: "account:banned",
  SUPPORT_REPLY_NEW: "support:reply:new",
  REPORT_STATUS_UPDATED: "report:status-updated",
  SYSTEM_MAINTENANCE_ON: "system:maintenance:on",
  SYSTEM_MAINTENANCE_OFF: "system:maintenance:off",
  MAINTENANCE_MODE_LEGACY: "maintenance-mode",
};

export const ADMIN_SOCKET_EVENTS = {
  USER_NEW: "admin:user:new",
  USER_LOGIN: "admin:user:login",
  USER_LOGOUT: "admin:user:logout",
  USER_STATUS_CHANGED: "admin:user:status-changed",
  USER_LOCKED: "admin:user:locked",
  USER_UNLOCKED: "admin:user:unlocked",
  USER_DELETED: "admin:user:deleted",
  USER_ROLE_UPDATED: "admin:user-role-updated",
  SUPPORT_NEW_MESSAGE: "admin:support:new-message",
  REPORT_NEW: "admin:report:new",
  REPORT_UPDATED: "admin:report:updated",
  DASHBOARD_STATS_UPDATED: "admin:dashboard:stats-updated",
  SYSTEM_NOTIFICATION: "admin:system:notification",
  MAINTENANCE_ON: "admin:maintenance:on",
  MAINTENANCE_OFF: "admin:maintenance:off",
};
