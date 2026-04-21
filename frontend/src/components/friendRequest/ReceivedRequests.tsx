import { useState } from "react";
import { toast } from "sonner";

import { getErrorMeta, logger } from "@/lib/logger";
import { useFriendStore } from "@/stores/useFriendStore";
import { Button } from "../ui/button";
import FriendRequestItem from "./FriendRequestItem";

const ReceivedRequests = () => {
  const { acceptRequest, declineRequest, receivedList } = useFriendStore();
  const [pendingRequest, setPendingRequest] = useState<{
    id: string;
    action: "accept" | "decline";
  } | null>(null);

  if (!receivedList || receivedList.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Khong co yeu cau ket ban nao.
      </p>
    );
  }

  const handleAccept = async (requestId: string) => {
    try {
      setPendingRequest({ id: requestId, action: "accept" });
      await acceptRequest(requestId);
      toast.success("Da chap nhan loi moi ket ban");
    } catch (error) {
      logger.error("Khong the chap nhan loi moi ket ban", getErrorMeta(error));
    } finally {
      setPendingRequest(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      setPendingRequest({ id: requestId, action: "decline" });
      await declineRequest(requestId);
      toast.success("Da tu choi loi moi ket ban");
    } catch (error) {
      logger.error("Khong the tu choi loi moi ket ban", getErrorMeta(error));
    } finally {
      setPendingRequest(null);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      {receivedList.map((req) => (
        <FriendRequestItem
          type="received"
          key={req._id}
          requestInfo={req}
          actions={
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleAccept(req._id)}
                disabled={pendingRequest !== null}
                loading={
                  pendingRequest?.id === req._id &&
                  pendingRequest.action === "accept"
                }
                loadingText="Dang chap nhan..."
              >
                Chap nhan
              </Button>
              <Button
                size="sm"
                variant="destructiveOutline"
                onClick={() => handleDecline(req._id)}
                disabled={pendingRequest !== null}
                loading={
                  pendingRequest?.id === req._id &&
                  pendingRequest.action === "decline"
                }
                loadingText="Dang tu choi..."
              >
                Tu choi
              </Button>
            </div>
          }
        />
      ))}
    </div>
  );
};

export default ReceivedRequests;
