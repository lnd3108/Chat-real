import { X } from "lucide-react";
import { playClickSound } from "@/features/settings/lib/sound";
import type { Message } from "@/shared/types/chat";
import { Button } from "@/shared/ui/button";

interface ReplyEditorBannerProps {
  replyingTo: Message | null;
  editingMessage: Message | null;
  onClear: () => void;
}

const ReplyEditorBanner = ({
  replyingTo,
  editingMessage,
  onClear,
}: ReplyEditorBannerProps) => {
  if (!replyingTo && !editingMessage) return null;

  return (
    <div className="flex items-start justify-between rounded-xl border border-border/60 bg-card px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-primary">
          {editingMessage ? "Đang chỉnh sửa tin nhắn" : "Đang trả lời"}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {editingMessage
            ? editingMessage.content || "Tin nhắn hình ảnh"
            : replyingTo?.content || (replyingTo?.imgUrl ? "Hình ảnh" : "Tin nhắn")}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => {
          playClickSound();
          onClear();
        }}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
};

export default ReplyEditorBanner;
