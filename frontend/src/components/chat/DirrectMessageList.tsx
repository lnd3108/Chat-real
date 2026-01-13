import { useChatStore } from "@/stores/useChatStore";
import DirectMessageCard from "./DirectMessageCard";

const DirrectMessageList = () => {
  const { conversations } = useChatStore();

  if (!conversations) return;

  const directConversations = conversations.filter(
    (convo) => convo.type === "direct"
  );

  return (
    <div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {directConversations.map((convo) => (
          <DirectMessageCard key={convo._id} convo={convo} />
        ))}
      </div>
    </div>
  );
};

export default DirrectMessageList;
