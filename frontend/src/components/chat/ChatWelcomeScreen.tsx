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
  
  // Ref để chặn effect chạy 2 lần trong StrictMode (dev)
  const effectRunRef = useRef(false);

  useEffect(() => {
    // 🔥 CHỐNG SPAM: Chỉ chạy khi có user ID và chưa có conversation
    if (!currentUserId || conversations.length > 0) {
      return;
    }

    // 🔥 CHỐNG SPAM: StrictMode dev chạy 2 lần → check ref
    if (effectRunRef.current) {
      console.info("[ChatWelcomeScreen] Effect đã chạy, skip lần 2");
      return;
    }
    effectRunRef.current = true;

    // 🔥 CHỐNG SPAM: Nếu chưa fetch, fetch lần đầu
    if (!hasFetched) {
      console.info("[ChatWelcomeScreen] Fetching suggestions...");
      void fetchSuggestions(5, false);
    }

    // 🔥 Cleanup: Hủy ref khi component unmount hoặc user thay đổi
    return () => {
      if (currentUserId === useAuthStore.getState().user?._id) {
        // Chỉ reset nếu user ID không thay đổi
        // (nếu logout → user ID thay đổi → component unmount)
      }
    };
  }, [currentUserId]); // ✅ Dependency: CHỈ user ID (ổn định)

  const handleRefreshSuggestions = useCallback(async () => {
    console.info("[ChatWelcomeScreen] User bấm reload");
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
              Chào mừng bạn đến với ChatRealTime
            </h2>
            <p className="text-muted-foreground">
              Tài khoản mới chưa có hội thoại nào. Bạn có thể bắt đầu bằng cách kết bạn với
              một vài người bên dưới.
            </p>
          </div>

          <UserSuggestionsList
            users={suggestions}
            loading={Boolean(currentUserId) && isFetching}
            title="Bạn có thể biết"
            emptyText="Chưa tìm thấy người phù hợp để gợi ý."
            onRefresh={handleRefreshSuggestions}
          />
        </div>
      </div>
    </SidebarInset>
  );
};

export default ChatWelcomeScreen;
