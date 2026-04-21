import { useState } from "react";
import { toast } from "sonner";

import { getErrorMeta, logger } from "@/lib/logger";
import { useFriendStore } from "@/stores/useFriendStore";
import { Button } from "../ui/button";
import FriendRequestItem from "./FriendRequestItem";

const SentRequest = () => {
  const { sentList, cancelSentRequest } = useFriendStore();
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  if (!sentList || sentList.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ban chua gui loi moi ket ban nao.
      </p>
    );
  }

  const handleCancel = async (requestId: string, targetUserId?: string) => {
    try {
      setPendingRequestId(requestId);
      await cancelSentRequest(requestId, targetUserId);
      toast.success("Da huy loi moi ket ban");
    } catch (error) {
      logger.error("Khong the huy loi moi ket ban", getErrorMeta(error));
      toast.error("Khong the huy loi moi ket ban");
    } finally {
      setPendingRequestId(null);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      {sentList.map((request) => (
        <FriendRequestItem
          key={request._id}
          requestInfo={request}
          type="sent"
          actions={
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Dang cho tra loi...</p>
              <Button
                size="sm"
                variant="destructiveOutline"
                disabled={pendingRequestId !== null}
                loading={pendingRequestId === request._id}
                loadingText="Dang huy..."
                onClick={() => void handleCancel(request._id, request.to?._id)}
              >
                Huy loi moi
              </Button>
            </div>
          }
        />
      ))}
    </div>
  );
};

export default SentRequest;
