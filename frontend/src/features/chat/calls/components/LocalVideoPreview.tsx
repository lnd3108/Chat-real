import { useEffect, useRef } from "react";

interface LocalVideoPreviewProps {
  stream: MediaStream | null;
}

const LocalVideoPreview = ({ stream }: LocalVideoPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream;

    if (import.meta.env.DEV) {
      const videoTrack = stream?.getVideoTracks()[0];
      console.debug("[CallVideo] Local stream bound", {
        audioTracks: stream?.getAudioTracks().length ?? 0,
        videoTracks: stream?.getVideoTracks().length ?? 0,
        localVideoEnabled: videoTrack?.enabled ?? false,
      });
    }

    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="h-full w-full scale-x-[-1] bg-black object-cover"
    />
  );
};

export default LocalVideoPreview;
