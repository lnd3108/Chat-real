import type { ReportPayload } from "@/components/profile/ReportTab";
import type { BlockedUser } from "@/components/profile/BlockTab";

const DIRECT_NOTIFICATION_KEY = "direct_chat_notification_settings";
const BLOCKED_USERS_KEY = "chat_blocked_users";
const REPORTS_KEY = "chat_reports";

type DirectNotificationSettings = Record<string, boolean>;
type StoredReport = ReportPayload & {
  createdAt: string;
  conversationId?: string;
};

const readJson = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    if (
      fallback !== null &&
      typeof fallback === "object" &&
      !Array.isArray(fallback) &&
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return { ...fallback, ...parsed } as T;
    }

    return parsed as T;
  } catch {
    return fallback;
  }
};

const writeJson = <T>(key: string, value: T) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
};

export const isDirectNotificationEnabled = (conversationId: string) => {
  const settings = readJson<DirectNotificationSettings>(DIRECT_NOTIFICATION_KEY, {});
  return settings[conversationId] ?? true;
};

export const setDirectNotificationEnabled = (
  conversationId: string,
  enabled: boolean,
) => {
  const settings = readJson<DirectNotificationSettings>(DIRECT_NOTIFICATION_KEY, {});
  writeJson(DIRECT_NOTIFICATION_KEY, {
    ...settings,
    [conversationId]: enabled,
  });
};

export const getBlockedUsers = () =>
  readJson<BlockedUser[]>(BLOCKED_USERS_KEY, []);

export const setBlockedUsers = (blockedUsers: BlockedUser[]) => {
  writeJson(BLOCKED_USERS_KEY, blockedUsers);
};

export const isUserBlocked = (userName?: string | null) => {
  if (!userName) return false;

  const normalized = userName.trim().toLowerCase();
  return getBlockedUsers().some(
    (user) => user.userName.trim().toLowerCase() === normalized,
  );
};

export const toggleBlockedUser = (userName: string, reason?: string) => {
  const blockedUsers = getBlockedUsers();
  const normalized = userName.trim().toLowerCase();
  const exists = blockedUsers.some(
    (user) => user.userName.trim().toLowerCase() === normalized,
  );

  if (exists) {
    const next = blockedUsers.filter(
      (user) => user.userName.trim().toLowerCase() !== normalized,
    );
    setBlockedUsers(next);
    return { blocked: false, items: next };
  }

  const next = [
    ...blockedUsers,
    {
      userName: userName.trim(),
      reason: reason?.trim() || undefined,
      createdAt: new Date().toISOString(),
    },
  ];
  setBlockedUsers(next);
  return { blocked: true, items: next };
};

export const appendReport = (report: StoredReport) => {
  const reports = readJson<StoredReport[]>(REPORTS_KEY, []);
  const next = [...reports, report];
  writeJson(REPORTS_KEY, next);
  return next;
};
