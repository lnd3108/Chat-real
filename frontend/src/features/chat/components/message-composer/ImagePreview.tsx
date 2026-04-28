import { Loader2, X } from "lucide-react";
import { playClickSound } from "@/features/settings/lib/sound";
import { Button } from "@/shared/ui/button";

interface ImagePreviewProps {
  previewUrl: string | null;
  pendingAction: "message" | "image" | "edit" | null;
  uploadProgress: number;
  sending: boolean;
  onReset: () => void;
}

const ImagePreview = ({
  previewUrl,
  pendingAction,
  uploadProgress,
  sending,
  onReset,
}: ImagePreviewProps) => {
  if (!previewUrl) return null;

  return (
    <div className="relative inline-flex overflow-hidden rounded-xl border border-border/60 bg-card p-2">
      <img
        src={previewUrl}
        alt="Preview"
        className="max-h-28 rounded-lg object-cover transition-opacity duration-200"
      />
      {pendingAction === "image" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/65 backdrop-blur-[1px]">
          <div className="w-full max-w-[180px] px-4">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="size-7 animate-spin text-primary" />
              <span className="text-xs font-medium text-foreground/80">
                {uploadProgress > 0
                  ? `Đang tải ảnh ${uploadProgress}%`
                  : "Đang tải ảnh..."}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/70">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${Math.max(uploadProgress, 8)}%` }}
              />
            </div>
          </div>
        </div>
      )}
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute -right-2 -top-2 size-6 rounded-full"
        onClick={() => {
          playClickSound();
          onReset();
        }}
        disabled={sending}
      >
        <X className="size-3" />
      </Button>
    </div>
  );
};

export default ImagePreview;
