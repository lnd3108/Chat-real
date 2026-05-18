import { useEffect, useRef, useState } from "react";

interface RemoteVideoProps {
  stream: MediaStream | null;
}

const RemoteVideo = ({ stream }: RemoteVideoProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  const hasVisibleVideoTrack =
    Boolean(stream?.getVideoTracks().length) || Boolean(stream && hasVideoTrack);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let isMounted = true;
    video.srcObject = stream;

    if (import.meta.env.DEV) {
      console.debug("[CallVideo] Remote stream bound", {
        audioTracks: stream?.getAudioTracks().length ?? 0,
        videoTracks: stream?.getVideoTracks().length ?? 0,
        remoteVideoReceived: Boolean(stream?.getVideoTracks().length),
      });
    }

    const updateTrackState = () => {
      if (!isMounted) return;
      setHasVideoTrack(Boolean(stream?.getVideoTracks().length));
    };

    window.queueMicrotask(updateTrackState);

    stream?.addEventListener("addtrack", updateTrackState);
    stream?.addEventListener("removetrack", updateTrackState);

    return () => {
      isMounted = false;
      stream?.removeEventListener("addtrack", updateTrackState);
      stream?.removeEventListener("removetrack", updateTrackState);
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        autoPlay
        muted={false}
        playsInline
        className="h-full w-full bg-black object-contain"
      />
      {!hasVisibleVideoTrack && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black text-sm font-medium text-white/80">
          Đang kết nối video...
        </div>
      )}
    </div>
  );
};

export default RemoteVideo;
