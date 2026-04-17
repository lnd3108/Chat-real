const STORAGE_KEY = "group_notification_settings";

type GroupNotificationSettings = Record<string, boolean>;

const readGroupNotificationSettings = (): GroupNotificationSettings => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeGroupNotificationSettings = (settings: GroupNotificationSettings) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const isGroupNotificationEnabled = (conversationId: string) => {
  const settings = readGroupNotificationSettings();
  return settings[conversationId] ?? true;
};

export const setGroupNotificationEnabled = (
  conversationId: string,
  enabled: boolean,
) => {
  const settings = readGroupNotificationSettings();
  settings[conversationId] = enabled;
  writeGroupNotificationSettings(settings);
};
