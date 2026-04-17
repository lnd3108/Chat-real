import { useState } from "react";
import { useFriendStore } from "@/stores/useFriendStore";
import FriendRequestItem from "./FriendRequestItem";
import { Button } from "../ui/button";
import { toast } from "sonner";

const ReceivedRequests = () => {
  const { acceptRequest, declineRequest, loading, receivedList } =
    useFriendStore();
  const [pendingRequest, setPendingRequest] = useState<{
    id: string;
    action: "accept" | "decline";
  } | null>(null);

  if (!receivedList || receivedList.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Không có yêu cầu kết bạn nào.
      </p>
    );
  }

  const handleAccept = async (requestId: string) => {
    try {
      setPendingRequest({ id: requestId, action: "accept" });
      await acceptRequest(requestId);
      toast.success("Đã chấp nhận lời mời kết bạn");
    } catch (error) {
      console.error(error);
    } finally {
      setPendingRequest(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      setPendingRequest({ id: requestId, action: "decline" });
      await declineRequest(requestId);
      toast.success("Đã từ chối lời mời kết bạn");
    } catch (error) {
      console.error(error);
    } finally {
      setPendingRequest(null);
    }
  };

  return (
    <div className="space-y-3 mt-4">
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
                disabled={loading}
                loading={
                  loading &&
                  pendingRequest?.id === req._id &&
                  pendingRequest.action === "accept"
                }
                loadingText="Đang chấp nhận..."
              >
                Chấp nhận
              </Button>
              <Button
                size="sm"
                variant="destructiveOutline"
                onClick={() => handleDecline(req._id)}
                disabled={loading}
                loading={
                  loading &&
                  pendingRequest?.id === req._id &&
                  pendingRequest.action === "decline"
                }
                loadingText="Đang từ chối..."
              >
                Từ chối
              </Button>
            </div>
          }
        />
      ))}
    </div>
  );
};

export default ReceivedRequests;
