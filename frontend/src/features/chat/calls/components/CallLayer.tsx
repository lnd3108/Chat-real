import ActiveCallPanel from "@/features/chat/calls/components/ActiveCallPanel";
import CallingModal from "@/features/chat/calls/components/CallingModal";
import IncomingCallModal from "@/features/chat/calls/components/IncomingCallModal";

const CallLayer = () => {
  return (
    <>
      <IncomingCallModal />
      <CallingModal />
      <ActiveCallPanel />
    </>
  );
};

export default CallLayer;
