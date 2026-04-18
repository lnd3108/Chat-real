import { getNotificationSettings } from "./messageNotifications";

export type SoundType = "notification" | "send";

export const soundMap: Record<SoundType, string> = {
  notification: "/frontend_public_sounds_notification.mp3",
  send: "/frontend_public_sounds_mouse-click.mp3",
};

export const soundConfig = {
  enabled: true,
};

const soundVolumeMap: Record<SoundType, number> = {
  notification: 0.75,
  send: 0.3,
};

const minIntervalMap: Record<SoundType, number> = {
  notification: 1200,
  send: 150,
};

const lastPlayedAt = new Map<SoundType, number>();

export const playSound = (type: SoundType) => {
  if (!soundConfig.enabled || typeof window === "undefined") {
    return;
  }

  const settings = getNotificationSettings();
  if (!settings.enableAll || !settings.messageSound) {
    return;
  }

  const now = Date.now();
  const lastPlayed = lastPlayedAt.get(type) ?? 0;

  if (now - lastPlayed < minIntervalMap[type]) {
    return;
  }

  lastPlayedAt.set(type, now);

  try {
    const audio = new Audio(soundMap[type]);
    audio.preload = "auto";
    audio.volume = soundVolumeMap[type];

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => undefined);
    }
  } catch {
    // Ignore audio failures so messaging never crashes.
  }
};
