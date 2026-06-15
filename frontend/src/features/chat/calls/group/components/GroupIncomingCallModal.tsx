import { Phone, PhoneOff } from "lucide-react";
import { useGroupCallStore } from "@/features/chat/calls/group/group-call.store";
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

const GroupIncomingCallModal = () => {
  const incomingGroupCall = useGroupCallStore((state) => state.incomingGroupCall);
  const acceptGroupCall = useGroupCallStore((state) => state.acceptGroupCall);
  const acceptGroupVideoCall = useGroupCallStore(
    (state) => state.acceptGroupVideoCall,
  );
  const declineGroupCall = useGroupCallStore((state) => state.declineGroupCall);
  const isJoining = useGroupCallStore((state) => state.isJoining);

  const callerName = incomingGroupCall?.caller?.displayName || "Thành viên";
  const groupName = incomingGroupCall?.groupName || "nhóm";
  const isVideoCall = incomingGroupCall?.callType === "video";

  return (
    <Dialog open={Boolean(incomingGroupCall)}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <UserAvatar
            type="chat"
            name={callerName}
            avatarUrl={incomingGroupCall?.caller?.avatarUrl ?? undefined}
          />
          <DialogTitle>
            {isVideoCall ? "Cuộc gọi video nhóm đến" : "Cuộc gọi thoại nhóm đến"}
          </DialogTitle>
          <DialogDescription>
            {isVideoCall
              ? `${callerName} đang bắt đầu cuộc gọi video trong nhóm ${groupName}`
              : `${callerName} đang bắt đầu cuộc gọi trong nhóm ${groupName}`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="destructive"
            disabled={isJoining}
            onClick={() => declineGroupCall(incomingGroupCall?.callId)}
          >
            <PhoneOff className="size-4" />
            Từ chối
          </Button>
          <Button
            type="button"
            disabled={isJoining}
            onClick={() =>
              isVideoCall
                ? acceptGroupVideoCall(incomingGroupCall?.callId)
                : acceptGroupCall(incomingGroupCall?.callId)
            }
          >
            <Phone className="size-4" />
            Tham gia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GroupIncomingCallModal;
