import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useFriendStore } from "@/stores/useFriendStore";
import FriendListModal from "../createNewChat/FriendListModal";
import { Dialog, DialogTrigger } from "../ui/dialog";
import { Card } from "../ui/card";

const CreateNewChat = () => {
  const [open, setOpen] = useState(false);

  const { getFriends, friends, loading } = useFriendStore();

  useEffect(() => {
    if (!open) return;
    getFriends();
  }, [open, getFriends]);

  return (
    <div className="flex gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button type="button" className="w-full text-left">
            <Card className="flex-1 p-3 glass hover:shadow-soft transition-smooth cursor-pointer group/card">
              <div className="flex items-center gap-4">
                <div className="size-8 bg-gradient-chat rounded-full flex items-center justify-center group-hover/card:scale-110 transition-bounce">
                  <MessageCircle className="size-4 text-white" />
                </div>
                <span className="text-sm font-medium capitalize">
                  Gửi tin nhắn mới
                </span>
              </div>
            </Card>
          </button>
        </DialogTrigger>

        <FriendListModal
          friends={friends}
          loading={loading}
          onPick={() => setOpen(false)}
        />
      </Dialog>
    </div>
  );
};

export default CreateNewChat;
