import { Phone, PhoneOff } from "lucide-react";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useCallStore } from "@/features/chat/calls/call.store";
import UserAvatar from "@/features/chat/components/UserAvatar";
import { getParticipantId, getParticipantProfile } from "@/features/chat/lib/chatParticipants";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

const IncomingCallModal = () => {
  const incomingCall = useCallStore((state) => state.incomingCall);
  const acceptCall = useCallStore((state) => state.acceptCall);
  const rejectCall = useCallStore((state) => state.rejectCall);
  const conversations = useChatStore((state) => state.conversations);
  const currentUserId = useAuthStore((state) => state.user?._id);

  const conversation = conversations.find(
    (item) => item._id === incomingCall?.conversationId,
  );
  const callerParticipant = conversation?.participants.find(
    (participant) => getParticipantId(participant) === incomingCall?.callerId,
  );
  const callerProfile = getParticipantProfile(callerParticipant);
  const callerName =
    callerProfile?.displayName ||
    (incomingCall?.callerId === currentUserId ? "Bạn" : "Người gọi");
  const callTypeLabel =
    incomingCall?.callType === "video" ? "Cuộc gọi video đến" : "Cuộc gọi thoại đến";

  return (
    <Dialog open={Boolean(incomingCall)}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <UserAvatar
            type="chat"
            name={callerName}
            avatarUrl={callerProfile?.avatarUrl ?? undefined}
          />
          <DialogTitle>{callerName}</DialogTitle>
          <DialogDescription>{callTypeLabel}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="destructive"
            onClick={() => rejectCall(incomingCall?.callSessionId)}
          >
            <PhoneOff className="size-4" />
            Từ chối
          </Button>
          <Button
            type="button"
            onClick={() => acceptCall(incomingCall?.callSessionId)}
          >
            <Phone className="size-4" />
            Chấp nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IncomingCallModal;
