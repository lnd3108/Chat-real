import { useEffect, useRef } from "react";

interface RemoteVideoProps {
  stream: MediaStream | null;
}

const RemoteVideo = ({ stream }: RemoteVideoProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="h-full w-full bg-muted object-cover"
    />
  );
};

export default RemoteVideo;
