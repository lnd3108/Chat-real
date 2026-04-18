const DIRECT_NOTIFICATION_KEY = "direct_chat_notification_settings";
const REPORTS_KEY = "chat_reports";

type DirectNotificationSettings = Record<string, boolean>;
type StoredReport = {
  targetUserName: string;
  reason: string;
  description: string;
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

export const appendReport = (report: StoredReport) => {
  const reports = readJson<StoredReport[]>(REPORTS_KEY, []);
  const next = [...reports, report];
  writeJson(REPORTS_KEY, next);
  return next;
};
