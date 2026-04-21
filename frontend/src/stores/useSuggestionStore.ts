import { create } from "zustand";

import { getErrorMessage } from "@/lib/httpError";
import { suggestionService } from "@/services/suggestionService";
import type { DiscoverUser } from "@/types/user";

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
      console.warn("[useSuggestionStore] Äang fetching, bá» qua request má»›i");
      return;
    }

    if (state.hasFetched && !force) {
      console.info("[useSuggestionStore] DÃ¹ng cached suggestions");
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
        "KhÃ´ng thá»ƒ táº£i danh sÃ¡ch gá»£i Ã½ káº¿t báº¡n. Vui lÃ²ng thá»­ láº¡i sau.",
      );
      console.error("[useSuggestionStore] Lá»—i fetch:", error);

      set({
        isFetching: false,
        error: message,
      });
    }
  },

  refreshSuggestions: async (limit = 5) => {
    console.info("[useSuggestionStore] LÃ m má»›i suggestions (force fetch)");
    await get().fetchSuggestions(limit, true);
  },

  resetSuggestions: () => {
    console.info("[useSuggestionStore] Reset suggestions");
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
