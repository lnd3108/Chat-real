import { getNotificationSettings } from "./messageNotifications";

type SingleSoundType = "notification" | "click" | "send" | "keystroke";
export type SoundType = SingleSoundType;

type KeystrokeEventLike = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  nativeEvent?: {
    isComposing?: boolean;
  };
};

const keystrokeSounds = [
  "/frontend_public_sounds_keystroke1.mp3",
  "/frontend_public_sounds_keystroke2.mp3",
  "/frontend_public_sounds_keystroke3.mp3",
  "/frontend_public_sounds_keystroke4.mp3",
] as const;

export const soundMap: Record<SoundType, string | readonly string[]> = {
  notification: "/frontend_public_sounds_notification.mp3",
  click: "/frontend_public_sounds_mouse-click.mp3",
  send: "/frontend_public_sounds_mouse-click.mp3",
  keystroke: keystrokeSounds,
};

export const soundConfig = {
  enabled: true,
};

const soundVolumeMap: Record<SoundType, number> = {
  notification: 0.75,
  click: 0.3,
  send: 0.3,
  keystroke: 0.18,
};

const minIntervalMap: Record<SoundType, number> = {
  notification: 1200,
  click: 100,
  send: 100,
  keystroke: 85,
};

const blockedKeystrokeKeys = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "Tab",
  "Escape",
  "CapsLock",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Insert",
  "Delete",
  "Backspace",
  "Enter",
]);

const lastPlayedAt = new Map<SoundType, number>();

const resolveSoundPath = (type: SoundType) => {
  const entry = soundMap[type];

  if (Array.isArray(entry)) {
    return entry[Math.floor(Math.random() * entry.length)];
  }

  return entry;
};

const canPlaySound = (type: SoundType) => {
  if (typeof window === "undefined" || !soundConfig.enabled) {
    return false;
  }

  const settings = getNotificationSettings();

  if (!settings.enableAll || !settings.soundEnabled) {
    return false;
  }

  if (type === "notification") {
    return settings.messageNotification && settings.messageSound;
  }

  if (type === "keystroke") {
    return settings.typingSound;
  }

  return settings.clickSound;
};

export const playSound = (type: SoundType) => {
  if (!canPlaySound(type)) {
    return;
  }

  const now = Date.now();
  const lastPlayed = lastPlayedAt.get(type) ?? 0;

  if (now - lastPlayed < minIntervalMap[type]) {
    return;
  }

  lastPlayedAt.set(type, now);

  try {
    const audio = new Audio(resolveSoundPath(type));
    audio.preload = "auto";
    audio.volume = soundVolumeMap[type];

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => undefined);
    }
  } catch {
    // Ignore audio failures so chat flow never crashes.
  }
};

export const playClickSound = () => {
  playSound("click");
};

export const playKeystrokeSound = () => {
  playSound("keystroke");
};

export const shouldPlayKeystrokeSound = (
  event: KeystrokeEventLike,
  isComposing = false,
) => {
  if (
    isComposing ||
    event.isComposing ||
    event.nativeEvent?.isComposing ||
    event.repeat
  ) {
    return false;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }

  if (blockedKeystrokeKeys.has(event.key)) {
    return false;
  }

  return event.key.length === 1;
};
