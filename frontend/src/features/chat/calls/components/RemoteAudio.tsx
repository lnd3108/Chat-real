import { useEffect, useRef } from "react";

interface RemoteAudioProps {
  stream: MediaStream | null;
}

const RemoteAudio = ({ stream }: RemoteAudioProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.srcObject = stream;
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline />;
};

export default RemoteAudio;
