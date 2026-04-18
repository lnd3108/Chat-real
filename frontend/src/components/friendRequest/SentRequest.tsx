import { useState } from "react";
import { toast } from "sonner";
import { useFriendStore } from "@/stores/useFriendStore";
import FriendRequestItem from "./FriendRequestItem";
import { Button } from "../ui/button";

const SentRequest = () => {
  const { sentList, cancelSentRequest, loading } = useFriendStore();
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  if (!sentList || sentList.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Bạn chưa gửi lời mời kết bạn nào.
      </p>
    );
  }

  const handleCancel = async (requestId: string, targetUserId?: string) => {
    try {
      setPendingRequestId(requestId);
      await cancelSentRequest(requestId, targetUserId);
      toast.success("Đã hủy lời mời kết bạn");
    } catch (error) {
      console.error(error);
      toast.error("Không thể hủy lời mời kết bạn");
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
              <p className="text-sm text-muted-foreground">Đang chờ trả lời...</p>
              <Button
                size="sm"
                variant="destructiveOutline"
                disabled={loading}
                loading={loading && pendingRequestId === request._id}
                loadingText="Đang hủy..."
                onClick={() => void handleCancel(request._id, request.to?._id)}
              >
                Hủy lời mời
              </Button>
            </div>
          }
        />
      ))}
    </div>
  );
};

export default SentRequest;
