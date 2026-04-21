import { create } from "zustand";
import type { DiscoverUser } from "@/types/user";
import { suggestionService } from "@/services/suggestionService";

interface SuggestionState {
  // State
  suggestions: DiscoverUser[];
  isFetching: boolean;
  hasFetched: boolean;
  lastFetchedAt: number;
  error: string | null;

  // Actions
  fetchSuggestions: (limit?: number, force?: boolean) => Promise<void>;
  refreshSuggestions: (limit?: number) => Promise<void>;
  resetSuggestions: () => void;
  setSuggestions: (suggestions: DiscoverUser[]) => void;
}

/**
 * Store để quản lý suggestions với logic chống spam
 *
 * Tóm tắt:
 * - isFetching: đang fetch từ API
 * - hasFetched: đã fetch ít nhất 1 lần
 * - lastFetchedAt: timestamp lần fetch cuối
 * - error: lỗi nếu có
 *
 * Logic chống spam:
 * - fetchSuggestions(): kiểm tra isFetching → không gọi lại nếu đang fetch
 * - refreshSuggestions(): force=true → hủy request cũ rồi fetch mới
 * - resetSuggestions(): xóa cache khi logout
 */
export const useSuggestionStore = create<SuggestionState>((set, get) => ({
  suggestions: [],
  isFetching: false,
  hasFetched: false,
  lastFetchedAt: 0,
  error: null,

  /**
   * Fetch suggestions với chống spam
   *
   * Logic:
   * 1. Nếu đang fetching → không gọi lại (return)
   * 2. Nếu đã fetch và force=false → không gọi (return cached)
   * 3. Nếu force=true → hủy request cũ rồi fetch mới
   * 4. Update store: isFetching=true, error=null
   * 5. Gọi API qua suggestionService
   * 6. Update store: suggestions, isFetching=false, hasFetched=true
   */
  fetchSuggestions: async (limit = 5, force = false) => {
    const state = get();

    // 🔥 CHỐNG SPAM #1: Đang fetching → bỏ qua
    if (state.isFetching && !force) {
      console.warn("[useSuggestionStore] Đang fetching, bỏ qua request mới");
      return;
    }

    // 🔥 CHỐNG SPAM #2: Đã fetch và không force → dùng cache
    if (state.hasFetched && !force) {
      console.info("[useSuggestionStore] Dùng cached suggestions");
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
    } catch (error: any) {
      const message =
        error?.message ||
        "Không thể tải danh sách gợi ý kết bạn. Vui lòng thử lại sau.";
      console.error("[useSuggestionStore] Lỗi fetch:", error);

      set({
        isFetching: false,
        error: message,
      });
    }
  },

  /**
   * Refresh suggestions (force fetch mới)
   *
   * Dùng khi:
   * - User bấm nút "Làm mới" / reload icon
   * - Hủy request cũ nếu có (abortController)
   * - Gọi fetch mới với force=true
   */
  refreshSuggestions: async (limit = 5) => {
    console.info("[useSuggestionStore] Làm mới suggestions (force fetch)");
    await get().fetchSuggestions(limit, true);
  },

  /**
   * Reset suggestions
   *
   * Dùng khi:
   * - User logout
   * - Clear cache để fetch mới lần login tới
   * - Hủy request đang chạy (nếu có)
   */
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

  /**
   * Set suggestions trực tiếp (nếu cần)
   */
  setSuggestions: (suggestions) => {
    set({ suggestions });
  },
}));
