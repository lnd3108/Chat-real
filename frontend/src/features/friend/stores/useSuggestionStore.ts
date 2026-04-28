import { create } from "zustand";

import { getErrorMessage } from "@/shared/lib/httpError";
import { getErrorMeta, logger } from "@/shared/lib/logger";
import { suggestionService } from "@/features/friend/services/suggestionService";
import type { DiscoverUser } from "@/shared/types/user";

interface SuggestionState {
  suggestions: DiscoverUser[];
  isFetching: boolean;
  hasFetched: boolean;
  lastFetchedAt: number;
  error: string | null;
  fetchSuggestions: (limit?: number, force?: boolean) => Promise<void>;
  refreshSuggestions: (limit?: number) => Promise<void>;
  resetSuggestions: () => void;
  setSuggestions: (suggestions: DiscoverUser[]) => void;
}

export const useSuggestionStore = create<SuggestionState>((set, get) => ({
  suggestions: [],
  isFetching: false,
  hasFetched: false,
  lastFetchedAt: 0,
  error: null,

  fetchSuggestions: async (limit = 5, force = false) => {
    const state = get();

    if (state.isFetching && !force) {
      return;
    }

    if (state.hasFetched && !force) {
      return;
    }

    set({
      isFetching: true,
      error: null,
    });

    try {
      const results = await suggestionService.fetchSuggestions(limit, force);

      set({
        suggestions: results,
        isFetching: false,
        hasFetched: true,
        lastFetchedAt: Date.now(),
        error: null,
      });
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Khong the tai danh sach goi y ket ban. Vui long thu lai sau.",
      );
      logger.error("Khong the tai danh sach goi y", getErrorMeta(error));

      set({
        isFetching: false,
        error: message,
      });
    }
  },

  refreshSuggestions: async (limit = 5) => {
    await get().fetchSuggestions(limit, true);
  },

  resetSuggestions: () => {
    suggestionService.cancel();

    set({
      suggestions: [],
      isFetching: false,
      hasFetched: false,
      lastFetchedAt: 0,
      error: null,
    });
  },

  setSuggestions: (suggestions) => {
    set({ suggestions });
  },
}));
