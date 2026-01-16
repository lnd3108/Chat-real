import { useFriendStore } from "@/stores/useFriendStore";
import FriendRequestItem from "./FriendRequestItem";

const SentRequest = () => {
  const { sentList } = useFriendStore();

  if (!sentList || sentList.length === 0) {
    return (
      <p className="tẽt-sm text-muted-foreground">
        Bạn chưa gửi lời mời kết bạn nào
      </p>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      <>
        {sentList.map((req) => (
          <FriendRequestItem
            key={req._id}
            requestInfo={req}
            type="sent"
            actions={
              <p className="text-muted-foreground text-sm">
                Đang chờ trả lời...
              </p>
            }
          />
        ))}
      </>
    </div>
  );
};

export default SentRequest;
