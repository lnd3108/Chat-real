import { getNotificationSettings } from "@/features/notification/lib/messageNotifications";

const RINGTONE_PATH = "/sounds/call-ringtone.mp3";
const DEFAULT_VOLUME = 0.7;

let audio: HTMLAudioElement | null = null;
let volume = DEFAULT_VOLUME;
let isPlaying = false;
let autoplayWarningLogged = false;

const canPlayRingtone = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const settings = getNotificationSettings();
  return settings.enableAll && settings.soundEnabled;
};

const getRingtoneAudio = () => {
  if (!audio) {
    audio = new Audio(RINGTONE_PATH);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = volume;
  }

  return audio;
};

const playLoopingRingtone = () => {
  if (!canPlayRingtone()) {
    stopRingtone();
    return;
  }

  try {
    const ringtoneAudio = getRingtoneAudio();
    ringtoneAudio.loop = true;
    ringtoneAudio.volume = volume;

    if (!ringtoneAudio.paused && isPlaying) {
      return;
    }

    ringtoneAudio.currentTime = 0;
    const playPromise = ringtoneAudio.play();

    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .then(() => {
          isPlaying = true;
        })
        .catch((error) => {
          isPlaying = false;
          if (!autoplayWarningLogged) {
            autoplayWarningLogged = true;
            console.warn(
              "Không thể phát nhạc chuông do trình duyệt chặn tự động phát âm thanh.",
              error instanceof Error ? error.message : error,
            );
          }
        });
      return;
    }

    isPlaying = true;
  } catch (error) {
    isPlaying = false;
    if (!autoplayWarningLogged) {
      autoplayWarningLogged = true;
      console.warn(
        "Không thể phát nhạc chuông cuộc gọi.",
        error instanceof Error ? error.message : error,
      );
    }
  }
};

export const playIncomingRingtone = () => {
  playLoopingRingtone();
};

export const playOutgoingRingtone = () => {
  // TODO: Tách file âm chờ riêng nếu cần UX khác với nhạc chuông cuộc gọi đến.
  playLoopingRingtone();
};

export const stopRingtone = () => {
  if (!audio) {
    isPlaying = false;
    return;
  }

  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    // Ringtone cleanup must never break the call flow.
  } finally {
    isPlaying = false;
  }
};

export const setVolume = (nextVolume: number) => {
  volume = Math.min(1, Math.max(0, nextVolume));
  if (audio) {
    audio.volume = volume;
  }
};

export const isRingtonePlaying = () => {
  return isPlaying && Boolean(audio && !audio.paused);
};

