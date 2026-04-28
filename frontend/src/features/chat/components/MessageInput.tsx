import { ImagePlus, Loader2, Send } from "lucide-react";
import { playClickSound } from "@/features/settings/lib/sound";
import type { Conversation } from "@/shared/types/chat";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import EmojiPicker from "@/features/chat/components/EmojiPicker";
import BlockedComposerBanner from "@/features/chat/components/message-composer/BlockedComposerBanner";
import ImagePreview from "@/features/chat/components/message-composer/ImagePreview";
import ReplyEditorBanner from "@/features/chat/components/message-composer/ReplyEditorBanner";
import { useMessageComposer } from "@/features/chat/components/message-composer/useMessageComposer";

const MessageInput = ({ selectedConvo }: { selectedConvo: Conversation }) => {
  const composer = useMessageComposer(selectedConvo);

  if (!composer.user) return null;

  return (
    <div className="space-y-2 bg-background p-3">
      {composer.statusText && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
          <Loader2 className="size-4 animate-spin" />
          <span className="font-medium">{composer.statusText}</span>
        </div>
      )}

      <ReplyEditorBanner
        replyingTo={composer.replyingTo}
        editingMessage={composer.editingMessage}
        onClear={() => {
          composer.setReplyingTo(null);
          composer.setEditingMessage(null);
          composer.setValue("");
        }}
      />

      <BlockedComposerBanner
        blockBannerText={composer.blockBannerText}
        displayName={composer.otherUser?.displayName}
        isBlockedByMe={composer.isBlockedByMe}
        isComposerBlocked={composer.isComposerBlocked}
        isUnblocking={composer.isUnblocking}
        onUnblock={composer.handleUnblock}
      />

      <ImagePreview
        previewUrl={composer.previewUrl}
        pendingAction={composer.pendingAction}
        uploadProgress={composer.uploadProgress}
        sending={composer.sending}
        onReset={composer.resetImage}
      />

      <div className="flex min-h-[56] items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="transition-smooth hover:bg-primary/10"
          asChild
          disabled={
            composer.sending ||
            composer.isComposerBlocked ||
            selectedConvo.type === "support"
          }
        >
          <label
            className={
              composer.sending
                ? "cursor-not-allowed pointer-events-none"
                : "cursor-pointer"
            }
            onClick={() => {
              if (!composer.sending && !composer.isComposerBlocked) {
                playClickSound();
              }
            }}
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={composer.handleSelectImage}
              disabled={
                composer.sending ||
                composer.isComposerBlocked ||
                selectedConvo.type === "support"
              }
            />
            <ImagePlus className="size-4" />
          </label>
        </Button>

        <div className="relative flex-1">
          <Input
            onKeyDown={composer.handleKeyPress}
            onBeforeInput={composer.handleBeforeInput}
            onCompositionStart={() => {
              composer.setIsComposing(true);
            }}
            onCompositionEnd={() => {
              composer.setIsComposing(false);
            }}
            value={composer.value}
            onChange={(e) => composer.setValue(e.target.value)}
            placeholder={
              selectedConvo.type === "support"
                ? "Nhập nội dung cần hỗ trợ..."
                : "Soạn tin nhắn..."
            }
            className="h-9 resize-none border-border/50 bg-white pr-20 transition-smooth focus:border-primary/50"
            disabled={composer.sending || composer.isComposerBlocked}
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="size-8 transition-smooth hover:bg-background/10"
              disabled={composer.isComposerBlocked}
            >
              <div>
                <EmojiPicker
                  onChange={(emoji: string) => {
                    if (!composer.isComposerBlocked) {
                      composer.setValue(`${composer.value}${emoji}`);
                    }
                  }}
                />
              </div>
            </Button>
          </div>
        </div>

        <Button
          onClick={() => {
            playClickSound();
            void composer.sendMessage();
          }}
          className="min-w-24 bg-gradient-chat transition-smooth hover:scale-105 hover:shadow-glow"
          disabled={
            composer.sending ||
            composer.isComposerBlocked ||
            (!composer.value.trim() && !composer.image)
          }
          aria-label={composer.statusText ?? "Gửi tin nhắn"}
        >
          {composer.sending ? (
            <>
              <Loader2 className="size-4 animate-spin text-white" />
              <span className="text-white">
                {composer.pendingAction === "edit"
                  ? "Đang lưu"
                  : composer.pendingAction === "image"
                    ? "Đang tải"
                    : "Đang gửi"}
              </span>
            </>
          ) : (
            <>
              <Send className="size-4 text-white" />
              <span className="text-white">Gửi</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;
