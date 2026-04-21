import { LifeBuoy, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/httpError";
import { logger } from "@/lib/logger";
import { useChatStore } from "@/stores/useChatStore";

import SupportChatCard from "./SupportChatCard";

const SupportConversationList = () => {
  const { conversations, getOrCreateSupportConversation, loading } = useChatStore();

  const supportConversations = conversations.filter((convo) => convo.type === "support");

  const handleOpenSupport = async () => {
    try {
      await getOrCreateSupportConversation();
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Không thể tạo cuộc trò chuyện hỗ trợ lúc này.",
      );
      logger.warn("Khong the khoi tao ho tro", { message });
      toast.error(message);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2 border-emerald-500/30 bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800"
        onClick={() => {
          void handleOpenSupport();
        }}
        disabled={loading}
      >
        <Plus className="size-4" />
        Liên hệ hỗ trợ
      </Button>

      {supportConversations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-center text-sm text-muted-foreground">
          <LifeBuoy className="mx-auto mb-2 size-4" />
          Chưa có cuộc trò chuyện hỗ trợ nào.
        </div>
      ) : (
        <div className="space-y-2">
          {supportConversations.map((conversation) => (
            <SupportChatCard key={conversation._id} convo={conversation} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SupportConversationList;
