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

type BeforeInputEventLike = {
  data?: string | null;
  inputType?: string | null;
  isComposing?: boolean;
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
const audioPoolByPath = new Map<string, HTMLAudioElement[]>();
const AUDIO_POOL_SIZE = 3;
const GLOBAL_CLICK_SELECTOR = [
  "button",
  "a[href]",
  "summary",
  "label[for]",
  "input[type='checkbox']",
  "input[type='radio']",
  "input[type='file']",
  "select",
  "[role='button']",
  "[role='menuitem']",
  "[role='option']",
  "[role='switch']",
  "[role='tab']",
  "[data-slot='button']",
  "[data-slot='switch']",
  "[data-slot='dropdown-menu-trigger']",
  "[data-slot='dropdown-menu-item']",
  "[data-slot='dropdown-menu-checkbox-item']",
  "[data-slot='dropdown-menu-radio-item']",
  "[data-slot='dropdown-menu-sub-trigger']",
  "[data-radix-collection-item]",
].join(", ");

const isElementDisabled = (element: Element | null) => {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element.getAttribute("aria-disabled") === "true") {
    return true;
  }

  if ("disabled" in element) {
    return Boolean((element as HTMLButtonElement | HTMLInputElement).disabled);
  }

  return false;
};

const isTextEntryTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target instanceof HTMLTextAreaElement) {
    return !target.disabled && !target.readOnly;
  }

  if (target instanceof HTMLInputElement) {
    const blockedTypes = new Set([
      "checkbox",
      "radio",
      "range",
      "file",
      "submit",
      "button",
      "reset",
      "color",
      "date",
      "datetime-local",
      "month",
      "time",
      "week",
    ]);

    return !target.disabled && !target.readOnly && !blockedTypes.has(target.type);
  }

  return target.isContentEditable;
};

const resolveSoundPath = (type: SoundType) => {
  const entry = soundMap[type];

  if (Array.isArray(entry)) {
    return entry[Math.floor(Math.random() * entry.length)];
  }

  return entry;
};

const getAudioFromPool = (path: string) => {
  const existingPool = audioPoolByPath.get(path);

  if (existingPool?.length) {
    const availableAudio =
      existingPool.find((audio) => audio.paused || audio.ended) ?? existingPool[0];

    availableAudio.currentTime = 0;
    return availableAudio;
  }

  const pool = Array.from({ length: AUDIO_POOL_SIZE }, () => {
    const audio = new Audio(path);
    audio.preload = "auto";
    return audio;
  });

  audioPoolByPath.set(path, pool);
  return pool[0];
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
    const audio = getAudioFromPool(resolveSoundPath(type));
    audio.volume = soundVolumeMap[type];
    audio.currentTime = 0;

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

export const shouldPlayBeforeInputSound = (event: BeforeInputEventLike) => {
  if (
    event.isComposing ||
    !event.inputType?.startsWith("insert") ||
    !event.data
  ) {
    return false;
  }

  return true;
};

export const shouldPlayGlobalClickSound = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return false;
  }

  const interactive = target.closest(GLOBAL_CLICK_SELECTOR);
  if (!interactive || isElementDisabled(interactive)) {
    return false;
  }

  return true;
};

export const shouldPlayGlobalKeystrokeSound = (
  event: KeystrokeEventLike,
  target: EventTarget | null,
) => {
  if (!isTextEntryTarget(target)) {
    return false;
  }

  return shouldPlayKeystrokeSound(event);
};

export const shouldPlayGlobalBeforeInputSound = (
  event: BeforeInputEventLike,
  target: EventTarget | null,
) => {
  if (!isTextEntryTarget(target)) {
    return false;
  }

  return shouldPlayBeforeInputSound(event);
};

export const installGlobalUiSoundEffects = () => {
  if (typeof document === "undefined") {
    return () => undefined;
  }

  const handleClick = (event: MouseEvent) => {
    if (shouldPlayGlobalClickSound(event.target)) {
      playClickSound();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (shouldPlayGlobalKeystrokeSound(event, event.target)) {
      playKeystrokeSound();
    }
  };

  const handleBeforeInput = (event: InputEvent) => {
    if (shouldPlayGlobalBeforeInputSound(event, event.target)) {
      playKeystrokeSound();
    }
  };

  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeyDown, true);
  document.addEventListener("beforeinput", handleBeforeInput, true);

  return () => {
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("keydown", handleKeyDown, true);
    document.removeEventListener("beforeinput", handleBeforeInput, true);
  };
};
