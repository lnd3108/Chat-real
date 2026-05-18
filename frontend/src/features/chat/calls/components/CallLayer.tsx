import { useEffect } from "react";

import { stopRingtone } from "@/features/chat/calls/call-ringtone.service";
import ActiveCallPanel from "@/features/chat/calls/components/ActiveCallPanel";
import CallingModal from "@/features/chat/calls/components/CallingModal";
import IncomingCallModal from "@/features/chat/calls/components/IncomingCallModal";

const CallLayer = () => {
  useEffect(() => {
    return () => {
      stopRingtone();
    };
  }, []);

  return (
    <>
      <IncomingCallModal />
      <CallingModal />
      <ActiveCallPanel />
    </>
  );
};

export default CallLayer;
