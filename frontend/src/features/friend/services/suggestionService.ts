import api from "@/shared/api/axios";
import { isAbortLikeError } from "@/shared/lib/httpError";
import { getErrorMeta, logger } from "@/shared/lib/logger";
import type { DiscoverUser } from "@/shared/types/user";

class SuggestionService {
  private abortController: AbortController | null = null;
  private isFetching = false;
  private lastFetchedAt = 0;
  private cachedResults: DiscoverUser[] | null = null;

  async fetchSuggestions(
    limit: number = 5,
    force: boolean = false,
  ): Promise<DiscoverUser[]> {
    if (this.isFetching && !force) {
      return this.cachedResults || [];
    }

    this.abortController?.abort();
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
    } catch (error) {
      if (!isAbortLikeError(error)) {
        logger.error("Khong the tai goi y ket ban", getErrorMeta(error));
      }
      return [];
    } finally {
      this.isFetching = false;
    }
  }

  cancel() {
    this.abortController?.abort();
    this.abortController = null;
    this.isFetching = false;
  }

  reset() {
    this.cancel();
    this.cachedResults = null;
    this.lastFetchedAt = 0;
  }

  getIsFetching(): boolean {
    return this.isFetching;
  }

  getHasFetched(): boolean {
    return this.lastFetchedAt > 0;
  }

  getCachedResults(): DiscoverUser[] {
    return this.cachedResults || [];
  }

  getLastFetchedAt(): number {
    return this.lastFetchedAt;
  }
}

export const suggestionService = new SuggestionService();
