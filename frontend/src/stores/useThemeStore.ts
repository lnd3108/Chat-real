import type { ThemeState } from "@/types/store";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const applyTheme = (dark: boolean) => {
  document.documentElement.classList.toggle("dark", dark);
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDark: false,
      toggleTheme: () => {
        const newValue = !get().isDark;
        set({ isDark: newValue });

        if (newValue) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      },
      setTheme: (dark: boolean) => {
        set({ isDark: dark });
        if (dark) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      },
    }),
    {
      name: "theme-storage",

      onRehydrateStorage: () => (state) => {
        if (!state) return;
        applyTheme(state.isDark);
      },
    },
  ),
);
