import { useEffect, useRef } from "react";

interface LocalVideoPreviewProps {
  stream: MediaStream | null;
}

const LocalVideoPreview = ({ stream }: LocalVideoPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="h-full w-full bg-muted object-cover"
    />
  );
};

export default LocalVideoPreview;
