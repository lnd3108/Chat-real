import { useEffect, useCallback, useRef } from "react";
import { SidebarInset, SidebarTrigger } from "../ui/sidebar";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useSuggestionStore } from "@/stores/useSuggestionStore";
import UserSuggestionsList from "./UserSuggestionsList";

const ChatWelcomeScreen = () => {
  const currentUserId = useAuthStore((state) => state.user?._id);
  const conversations = useChatStore((state) => state.conversations);
  const {
    suggestions,
    isFetching,
    hasFetched,
    fetchSuggestions,
    refreshSuggestions,
  } = useSuggestionStore();

  const effectRunRef = useRef(false);

  useEffect(() => {
    if (!currentUserId || conversations.length > 0) {
      return;
    }

    if (effectRunRef.current) {
      return;
    }
    effectRunRef.current = true;

    if (!hasFetched) {
      void fetchSuggestions(5, false);
    }
  }, [currentUserId, conversations.length, fetchSuggestions, hasFetched]);

  const handleRefreshSuggestions = useCallback(async () => {
    await refreshSuggestions(5);
  }, [refreshSuggestions]);

  return (
    <SidebarInset className="flex h-full w-full bg-transparent">
      <header className="sticky top-0 z-10 flex w-full items-center gap-2 px-4 py-2 md:hidden">
        <SidebarTrigger className="-ml-1 text-foreground" />
      </header>

      <div className="flex flex-1 items-center justify-center rounded-2xl bg-primary-foreground p-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          <div className="text-center">
            <div className="pulse-ring mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-gradient-chat shadow-glow">
              <span className="text-3xl">💬</span>
            </div>
            <h2 className="mb-2 bg-gradient-chat bg-clip-text text-2xl font-bold text-transparent">
              Chao mung ban den voi ChatRealTime
            </h2>
            <p className="text-muted-foreground">
              Tai khoan moi chua co hoi thoai nao. Ban co the bat dau bang cach ket ban voi
              mot vai nguoi ben duoi.
            </p>
          </div>

          <UserSuggestionsList
            users={suggestions}
            loading={Boolean(currentUserId) && isFetching}
            title="Ban co the biet"
            emptyText="Chua tim thay nguoi phu hop de goi y."
            onRefresh={handleRefreshSuggestions}
          />
        </div>
      </div>
    </SidebarInset>
  );
};

export default ChatWelcomeScreen;
