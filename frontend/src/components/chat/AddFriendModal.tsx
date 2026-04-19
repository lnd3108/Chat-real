import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { playClickSound } from "@/lib/sound";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFriendStore } from "@/stores/useFriendStore";
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
  const { searchUsers, getSuggestions, suggestions, searchLoading, suggestionsLoading } =
    useFriendStore();

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSearchResults([]);
      return;
    }

    if (!currentUserId) {
      return;
    }

    if (!trimmedQuery) {
      void getSuggestions(10);
      setSearchResults([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void searchUsers(trimmedQuery, 10).then(setSearchResults);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [currentUserId, open, trimmedQuery, searchUsers, getSuggestions]);

  const displayedUsers = useMemo(
    () => (trimmedQuery ? searchResults : suggestions),
    [searchResults, suggestions, trimmedQuery],
  );

  const currentLoading = trimmedQuery ? searchLoading : suggestionsLoading;
  const emptyText = trimmedQuery
    ? `Không tìm thấy user gần đúng với "${trimmedQuery}".`
    : "Chưa có gợi ý phù hợp.";

  const handleRefreshSuggestions = async () => {
    await getSuggestions(10);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        playClickSound();
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
