import { useChatStore } from "@/features/chat/stores/useChatStore";
import GroupChatCard from "@/features/chat/components/GroupChatCard";

const GroupChatList = () => {
  const { conversations } = useChatStore();

  if (!conversations) return;

  const groupchats = conversations.filter((convo) => convo.type === "group");
  return (
    <div className="space-y-2 p-2">
      {groupchats.map((convo) => (
        <GroupChatCard key={convo._id} convo={convo} />
      ))}
    </div>
  );
};

export default GroupChatList;
