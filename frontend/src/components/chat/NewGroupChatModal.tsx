import { useFriendStore } from "@/stores/useFriendStore";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { UserPlus, Users } from "lucide-react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import type { Friend } from "@/types/user";

import SelectedUsersList from "../newGroupChat/SelectedUsersList";
import { toast } from "sonner";
import { useChatStore } from "@/stores/useChatStore";
import InviteSuggestionList from "../newGroupChat/InviteSuggestionList";

const NewGroupChatModal = () => {
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const { friends, getFriends } = useFriendStore();
  const [invitedUsers, setInvitedUsers] = useState<Friend[]>([]);
  const [open, setOpen] = useState(false);
  const resetForm = () => {
    setGroupName("");
    setSearch("");
    setInvitedUsers([]);
  };

  const { loading, createConversation } = useChatStore();

  const handleGetFriends = async () => {
    await getFriends();
  };

  const handleSelectFriend = (friend: Friend) => {
    setInvitedUsers([...invitedUsers, friend]);
    setSearch("");
  };

  const handleRemoveFriend = (user: Friend) => {
    setInvitedUsers(invitedUsers.filter((u) => u._id !== user._id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    try {
      e.preventDefault();
      if (invitedUsers.length === 0) {
        toast.warning("Hãy chọn ít nhất một người bạn vào nhóm.");
        return;
      }

      await createConversation(
        "group",
        groupName,
        invitedUsers.map((u) => u._id),
      );

      resetForm();
      setOpen(false);
    } catch (error) {
      console.error("Lỗi khi tạo nhóm chat:", error);
      toast.error("Không thể tạo nhóm chat. Vui lòng thử lại.");
    }
  };

  const filteredFriends = friends.filter(
    (friend) =>
      friend.displayName.toLowerCase().includes(search.toLowerCase()) &&
      !invitedUsers.some((u) => u._id === friend._id),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          onClick={handleGetFriends}
          className="flex z-10 justify-center items-center size-5 rounded-full hover:bg-sidebar-accent transition cursor-pointer"
        >
          <Users className="size-4" />
          <span className="sr-only">Tạo nhóm chat mới</span>
        </Button>
      </DialogTrigger>

      {/* Dialog Content can be added here later */}
      <DialogContent className="sm:max-w-[425px] border-none">
        <DialogHeader>
          <DialogTitle>Tạo nhóm chat mới</DialogTitle>
          <DialogDescription>Chọn bạn bè và đặt tên nhóm</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Group Name Input */}
          <div className="space-y-2">
            <Label htmlFor="group-name" className="text-sm font-semibold">
              Tên nhóm
            </Label>
            <Input
              id="group-name"
              placeholder="Nhập tên nhóm"
              className="glass border-border/50 focus:border-primary/50 transition-smooth"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
          </div>

          {/* Friends List and Search can be added here later */}
          <div className="space-y-2">
            <Label htmlFor="invite" className="text-sm font-semibold">
              Thêm bạn bè
            </Label>
            <Input
              id="invite"
              placeholder="Tìm bạn bè..."
              className="glass border-border/50 focus:border-primary/50 transition-smooth"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {/* Friends list rendering can be added here */}
            {search && filteredFriends.length > 0 && (
              <InviteSuggestionList
                filteredFriends={filteredFriends}
                onSelect={handleSelectFriend}
              />
            )}

            {/* {List Users selected} */}
            <SelectedUsersList
              invitedUsers={invitedUsers}
              onRemove={handleRemoveFriend}
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-chat text-white hover:opacity/90 transition-smooth"
              loading={loading}
              loadingText="Đang tạo nhóm..."
            >
              {loading ? (
                <span>Đang tạo nhóm...</span>
              ) : (
                <>
                  <UserPlus className="size-4 mr-2" />
                  <span>Tạo nhóm chat</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewGroupChatModal;
