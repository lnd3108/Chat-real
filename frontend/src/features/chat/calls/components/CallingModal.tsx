import { PhoneOff } from "lucide-react";
import { useCallStore } from "@/features/chat/calls/call.store";
import { CALL_STATUS } from "@/features/chat/calls/call.constants";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { getParticipantId, getParticipantProfile } from "@/features/chat/lib/chatParticipants";
import UserAvatar from "@/features/chat/components/UserAvatar";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

const CallingModal = () => {
  const currentCall = useCallStore((state) => state.currentCall);
  const callStatus = useCallStore((state) => state.callStatus);
  const cancelCall = useCallStore((state) => state.cancelCall);
  const conversations = useChatStore((state) => state.conversations);
  const currentUserId = useAuthStore((state) => state.user?._id);

  const isCalling = Boolean(currentCall) && callStatus === CALL_STATUS.RINGING;
  const conversation = conversations.find(
    (item) => item._id === currentCall?.conversationId,
  );
  const peerParticipant = conversation?.participants.find(
    (participant) => getParticipantId(participant) !== currentUserId,
  );
  const peerProfile = getParticipantProfile(peerParticipant);
  const peerName = peerProfile?.displayName || "Người nhận";
  const callingLabel =
    currentCall?.callType === "video" ? "Đang gọi video..." : "Đang gọi thoại...";

  return (
    <Dialog open={isCalling}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <UserAvatar
            type="chat"
            name={peerName}
            avatarUrl={peerProfile?.avatarUrl ?? undefined}
          />
          <DialogTitle>{peerName}</DialogTitle>
          <DialogDescription>{callingLabel}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="destructive"
            onClick={() => cancelCall(currentCall?.callSessionId)}
            className="w-full"
          >
            <PhoneOff className="size-4" />
            Hủy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CallingModal;
