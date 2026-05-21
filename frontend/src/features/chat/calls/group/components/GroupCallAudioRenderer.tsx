import { useEffect, useRef } from "react";

const RemoteGroupAudio = ({ stream }: { stream: MediaStream }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;
    audioElement.srcObject = stream;

    return () => {
      audioElement.srcObject = null;
    };
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
};

const GroupCallAudioRenderer = ({
  streamsByUserId,
}: {
  streamsByUserId: Record<string, MediaStream>;
}) => (
  <>
    {Object.entries(streamsByUserId).map(([userId, stream]) => (
      <RemoteGroupAudio key={userId} stream={stream} />
    ))}
  </>
);

export default GroupCallAudioRenderer;
