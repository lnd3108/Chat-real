import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { playClickSound } from "@/lib/sound";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFriendStore } from "@/stores/useFriendStore";
import { useSuggestionStore } from "@/stores/useSuggestionStore";
import type { DiscoverUser } from "@/types/user";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import UserSuggestionsList from "./UserSuggestionsList";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

export interface IFormValues {
  userName: string;
  message: string;
}

const AddFriendModal = () => {
  const currentUserId = useAuthStore((state) => state.user?._id);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DiscoverUser[]>([]);
  const searchUsers = useFriendStore((state) => state.searchUsers);
  const searchLoading = useFriendStore((state) => state.searchLoading);
  const {
    suggestions,
    isFetching: isFetchingSuggestions,
    hasFetched: hasFetchedSuggestions,
    fetchSuggestions,
    refreshSuggestions,
  } = useSuggestionStore();

  const effectRunRef = useRef(false);
  const modalFirstOpenRef = useRef(false);
  const searchTimeoutRef = useRef<number | null>(null);
  const trimmedQuery = query.trim();

  const clearSearchState = useCallback(() => {
    setQuery("");
    setSearchResults([]);
  }, []);

  useEffect(() => {
    if (!open || !currentUserId) {
      return;
    }

    if (effectRunRef.current && !trimmedQuery) {
      return;
    }

    if (!trimmedQuery) {
      effectRunRef.current = true;

      if (!modalFirstOpenRef.current && !hasFetchedSuggestions) {
        modalFirstOpenRef.current = true;
        void fetchSuggestions(5, false);
      }

      return;
    }

    effectRunRef.current = false;
    modalFirstOpenRef.current = false;

    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      void searchUsers(trimmedQuery, 10).then(setSearchResults);
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    };
  }, [
    currentUserId,
    fetchSuggestions,
    hasFetchedSuggestions,
    open,
    searchUsers,
    trimmedQuery,
  ]);

  const displayedUsers = useMemo(
    () => (trimmedQuery ? searchResults : suggestions),
    [searchResults, suggestions, trimmedQuery],
  );

  const currentLoading = trimmedQuery ? searchLoading : isFetchingSuggestions;
  const emptyText = trimmedQuery
    ? `Không tìm thấy user gần đúng với "${trimmedQuery}".`
    : "Chưa có gợi ý phù hợp.";

  const handleRefreshSuggestions = useCallback(async () => {
    await refreshSuggestions(5);
  }, [refreshSuggestions]);

  const handleOpenChange = (nextOpen: boolean) => {
    playClickSound();

    if (!nextOpen) {
      effectRunRef.current = false;
      modalFirstOpenRef.current = false;

      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }

      clearSearchState();
      toast.dismiss();
    }

    setOpen(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="z-10 flex size-5 cursor-pointer items-center justify-center rounded-full transition hover:bg-sidebar-accent"
        >
          <UserPlus className="size-4" />
          <span className="sr-only">Kết bạn</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-border/40 bg-card/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-2xl">
        <DialogHeader className="border-b border-border/40 px-5 py-4">
          <DialogTitle className="text-xl">Kết bạn</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Tìm người dùng rồi gửi lời mời kết bạn.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Vi du: vanhle"
              className="h-11 rounded-xl pl-11"
            />
          </div>

          {trimmedQuery && displayedUsers.length === 0 && !currentLoading ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-background/20 px-4 py-6 text-sm text-muted-foreground">
              {emptyText}
            </div>
          ) : null}

          <UserSuggestionsList
            users={displayedUsers}
            loading={Boolean(currentUserId) && currentLoading}
            compact
            title={
              trimmedQuery ? "Kết quả tìm kiếm" : "Những người bạn có thể biết"
            }
            emptyText={emptyText}
            onRefresh={!trimmedQuery ? handleRefreshSuggestions : undefined}
          />
        </div>

        <div className="flex justify-end border-t border-border/40 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => setOpen(false)}
          >
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddFriendModal;
