import { useEffect, useState } from "react";

import {
  areAllSoundsEnabled,
  getNotificationSettings,
  setAllSoundsEnabled,
  subscribeNotificationSettings,
} from "@/features/notification/lib/messageNotifications";

export const useSoundSettings = () => {
  const [soundEnabled, setSoundEnabledState] = useState(() =>
    areAllSoundsEnabled(getNotificationSettings()),
  );

  useEffect(
    () =>
      subscribeNotificationSettings((settings) => {
        setSoundEnabledState(areAllSoundsEnabled(settings));
      }),
    [],
  );

  const setSoundEnabled = (enabled: boolean) => {
    setSoundEnabledState(enabled);
    setAllSoundsEnabled(enabled);
  };

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
  };

  return {
    soundEnabled,
    setSoundEnabled,
    toggleSound,
  };
};
