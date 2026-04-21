import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  const { searchUsers, searchLoading } = useFriendStore();
  const {
    suggestions,
    isFetching: isFetchingSuggestions,
    hasFetched: hasFetchedSuggestions,
    fetchSuggestions,
    refreshSuggestions,
  } = useSuggestionStore();

  // Ref để chặn effect chạy 2 lần trong StrictMode
  const effectRunRef = useRef(false);
  // Ref để track xem modal mở lần đầu hay không
  const modalFirstOpenRef = useRef(false);
  // Timeout ID để clear khi unmount
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const trimmedQuery = query.trim();

  // 🔥 Reset ref khi modal close
  useEffect(() => {
    if (!open) {
      effectRunRef.current = false;
      modalFirstOpenRef.current = false;
      setQuery("");
      setSearchResults([]);
    }
  }, [open]);

  // 🔥 CHỐNG SPAM: Main effect - fetch suggestions khi modal mở, search khi user nhập
  useEffect(() => {
    if (!open || !currentUserId) {
      return;
    }

    // 🔥 StrictMode dev chạy 2 lần → block lần 2
    if (effectRunRef.current && !trimmedQuery) {
      console.info("[AddFriendModal] Effect đã chạy, skip lần 2");
      return;
    }

    if (!trimmedQuery) {
      // 🔥 CASE: Modal mở / query được clear
      effectRunRef.current = true;

      // 🔥 Chỉ fetch suggestions khi:
      // - Modal mở lần đầu (modalFirstOpenRef.current = false)
      // - Hoặc user bấm clear query
      // - Và chưa fetch bao giờ (hasFetchedSuggestions = false)
      if (!modalFirstOpenRef.current && !hasFetchedSuggestions) {
        modalFirstOpenRef.current = true;
        console.info("[AddFriendModal] Fetching suggestions khi modal mở lần đầu");
        void fetchSuggestions(5, false);
      }
      return;
    }

    // 🔥 CASE: User nhập query để tìm kiếm
    // Reset flag để lần sau khi clear query sẽ fetch suggestions lại
    effectRunRef.current = false;
    modalFirstOpenRef.current = false;

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      console.info("[AddFriendModal] Searching with query:", trimmedQuery);
      void searchUsers(trimmedQuery, 10).then(setSearchResults);
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [
    open,
    trimmedQuery,
    currentUserId,
    // 🔥 Dependency: CHỈ user ID, query, open (ổn định)
    // KHÔNG dùng suggestionsLoading, searchLoading, suggestions, searchResults
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
    console.info("[AddFriendModal] User bấm reload suggestions");
    await refreshSuggestions(5);
  }, [refreshSuggestions]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        playClickSound();
        if (!nextOpen) {
          setQuery("");
          setSearchResults([]);
        }
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="flex z-10 justify-center items-center size-5 rounded-full hover:bg-sidebar-accent transition cursor-pointer"
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
              placeholder="Ví dụ: vanhle"
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
            title={trimmedQuery ? "Kết quả tìm kiếm" : "Bạn có thể biết"}
            emptyText={emptyText}
            onRefresh={!trimmedQuery ? handleRefreshSuggestions : undefined}
          />
        </div>

        <div className="flex justify-end border-t border-border/40 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              setOpen(false);
              toast.dismiss();
            }}
          >
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddFriendModal;
