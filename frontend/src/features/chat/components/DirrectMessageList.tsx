import { useChatStore } from "@/features/chat/stores/useChatStore";
import DirectMessageCard from "@/features/chat/components/DirectMessageCard";

const DirrectMessageList = () => {
  const { conversations } = useChatStore();

  if (!conversations) return;

  const directConversations = conversations.filter(
    (convo) => convo.type === "direct"
  );

  return (
    <div className="space-y-2 p-2">
      {directConversations.map((convo) => (
        <DirectMessageCard key={convo._id} convo={convo} />
      ))}
    </div>
  );
};

export default DirrectMessageList;
