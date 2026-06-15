import { Mic, MicOff, VideoOff } from "lucide-react";
import { useEffect, useRef } from "react";
import UserAvatar from "@/features/chat/components/UserAvatar";
import { cn } from "@/shared/lib/utils";

interface GroupVideoTileProps {
  stream?: MediaStream | null;
  displayName: string;
  avatarUrl?: string | null;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  isLocal?: boolean;
  className?: string;
}

const GroupVideoTile = ({
  stream,
  displayName,
  avatarUrl,
  audioEnabled = true,
  videoEnabled = false,
  isLocal = false,
  className,
}: GroupVideoTileProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shouldShowVideo = Boolean(stream && videoEnabled);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    videoElement.srcObject = shouldShowVideo ? stream ?? null : null;

    return () => {
      videoElement.srcObject = null;
    };
  }, [shouldShowVideo, stream]);

  return (
    <div
      className={cn(
        "relative min-h-44 overflow-hidden rounded-lg border bg-muted text-foreground",
        className,
      )}
    >
      {shouldShowVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full min-h-44 flex-col items-center justify-center gap-3 bg-card">
          <UserAvatar
            type="profile"
            name={displayName}
            avatarUrl={avatarUrl ?? undefined}
            className="size-20 text-2xl"
          />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <VideoOff className="size-4" />
            <span>Camera đang tắt</span>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/55 px-3 py-2 text-white">
        <span className="truncate text-sm font-medium">
          {displayName}
          {isLocal ? " (Bạn)" : ""}
        </span>
        {audioEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
      </div>
    </div>
  );
};

export default GroupVideoTile;
