import { useFriendStore } from "@/stores/useFriendStore";

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
      <>{sentList.map((req) => console.log(req))}</>
    </div>
  );
};

export default SentRequest;
