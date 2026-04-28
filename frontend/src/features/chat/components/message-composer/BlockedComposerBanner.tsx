import { Loader2 } from "lucide-react";
import { playClickSound } from "@/features/settings/lib/sound";
import { Button } from "@/shared/ui/button";

interface BlockedComposerBannerProps {
  blockBannerText: string | null;
  displayName?: string;
  isBlockedByMe: boolean;
  isComposerBlocked: boolean;
  isUnblocking: boolean;
  onUnblock: () => void;
}

const BlockedComposerBanner = ({
  blockBannerText,
  displayName,
  isBlockedByMe,
  isComposerBlocked,
  isUnblocking,
  onUnblock,
}: BlockedComposerBannerProps) => {
  if (!isComposerBlocked) return null;

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-destructive">{blockBannerText}</p>
          {isBlockedByMe && displayName && (
            <p className="mt-1 text-xs text-muted-foreground">
              Cuộc trò chuyện với {displayName} vẫn được giữ lại, nhưng gửi
              tin nhắn mới đang bị tắt cho đến khi bạn bỏ chặn.
            </p>
          )}
        </div>

        {isBlockedByMe && (
          <Button
            type="button"
            variant="outline"
            className="border-destructive/30 bg-background/80 text-destructive hover:bg-destructive/10 hover:text-destructive sm:shrink-0"
            onClick={() => {
              playClickSound();
              void onUnblock();
            }}
            disabled={isUnblocking}
          >
            {isUnblocking ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Đang bỏ chặn</span>
              </>
            ) : (
              <span>Bỏ chặn</span>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default BlockedComposerBanner;
