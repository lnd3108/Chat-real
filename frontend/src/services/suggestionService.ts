import api from "@/lib/axios";
import type { DiscoverUser } from "@/types/user";

/**
 * Service quản lý suggestion requests
 * - Giữ track trạng thái: fetching, fetched, lastTime
 * - Support AbortController để hủy request
 * - Chống spam request
 */
class SuggestionService {
  private abortController: AbortController | null = null;
  private isFetching = false;
  private lastFetchedAt = 0;
  private cachedResults: DiscoverUser[] | null = null;

  /**
   * Lấy suggestions với chống spam built-in
   * @param limit - Giới hạn số user (default 5)
   * @param force - Bỏ qua cache, force fetch mới (default false)
   * @returns Danh sách suggestions
   */
  async fetchSuggestions(
    limit: number = 5,
    force: boolean = false
  ): Promise<DiscoverUser[]> {
    // 🔥 CHỐNG SPAM: Nếu đang fetching → hủy request cũ + fetch lại
    if (this.isFetching && !force) {
      console.warn("[SuggestionService] Đang fetching, bỏ qua request mới");
      return this.cachedResults || [];
    }

    // Hủy request cũ nếu có
    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();
    this.isFetching = true;

    try {
      const res = await api.get(`/users/suggestions?limit=${limit}`, {
        signal: this.abortController.signal,
        timeout: 8000,
      });

      const users = res.data.users || [];
      this.cachedResults = users;
      this.lastFetchedAt = Date.now();

      return users;
    } catch (error: any) {
      // Chỉ log nếu không phải request bị hủy
      if (error.name !== "AbortError") {
        console.error("[SuggestionService] Lỗi fetch suggestions:", error);
      }
      return [];
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Hủy request hiện tại
   */
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isFetching = false;
  }

  /**
   * Reset service state
   */
  reset() {
    this.cancel();
    this.cachedResults = null;
    this.lastFetchedAt = 0;
  }

  /**
   * Kiểm tra xem có đang fetching không
   */
  getIsFetching(): boolean {
    return this.isFetching;
  }

  /**
   * Kiểm tra xem đã fetch bao giờ chưa
   */
  getHasFetched(): boolean {
    return this.lastFetchedAt > 0;
  }

  /**
   * Lấy cached results
   */
  getCachedResults(): DiscoverUser[] {
    return this.cachedResults || [];
  }

  /**
   * Lấy thời điểm fetch cuối cùng
   */
  getLastFetchedAt(): number {
    return this.lastFetchedAt;
  }
}

/**
 * Singleton instance
 */
export const suggestionService = new SuggestionService();
