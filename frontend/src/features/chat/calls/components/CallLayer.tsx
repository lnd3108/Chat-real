import { useEffect } from "react";

import { stopRingtone } from "@/features/chat/calls/call-ringtone.service";
import ActiveCallPanel from "@/features/chat/calls/components/ActiveCallPanel";
import CallingModal from "@/features/chat/calls/components/CallingModal";
import IncomingCallModal from "@/features/chat/calls/components/IncomingCallModal";
import GroupCallPanel from "@/features/chat/calls/group/components/GroupCallPanel";
import GroupIncomingCallModal from "@/features/chat/calls/group/components/GroupIncomingCallModal";
import { useGroupCallStore } from "@/features/chat/calls/group/group-call.store";

const CallLayer = () => {
  useEffect(() => {
    return () => {
      stopRingtone();
      useGroupCallStore.getState().clearGroupCall();
    };
  }, []);

  return (
    <>
      <IncomingCallModal />
      <GroupIncomingCallModal />
      <CallingModal />
      <ActiveCallPanel />
      <GroupCallPanel />
    </>
  );
};

export default CallLayer;
