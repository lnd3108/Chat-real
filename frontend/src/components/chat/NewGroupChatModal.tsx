import { useFriendStore } from "@/stores/useFriendStore";
import { useState, useEffect } from "react";
import { playClickSound } from "@/lib/sound";
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
  const { friends, getFriends, loading: friendsLoading } = useFriendStore();
  const [invitedUsers, setInvitedUsers] = useState<Friend[]>([]);
  const [open, setOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const resetForm = () => {
    setGroupName("");
    setSearch("");
    setInvitedUsers([]);
  };

  const { loading, createConversation } = useChatStore();

  useEffect(() => {
    if (open && friends.length === 0 && !isInitializing) {
      setIsInitializing(true);
      getFriends().finally(() => setIsInitializing(false));
    }
  }, [open, friends.length, getFriends]);

  const handleSelectFriend = (friend: Friend) => {
    const isSelected = invitedUsers.some((u) => u._id === friend._id);
    
    if (isSelected) {
      setInvitedUsers(invitedUsers.filter((u) => u._id !== friend._id));
    } else {
      setInvitedUsers([...invitedUsers, friend]);
    }
  };

  const handleRemoveFriend = (user: Friend) => {
    setInvitedUsers(invitedUsers.filter((u) => u._id !== user._id));
  };

  const filteredFriends = friends.filter(
    (friend) =>
      !invitedUsers.some((u) => u._id === friend._id) &&
      (friend.displayName.toLowerCase().includes(search.toLowerCase()) ||
        friend.userName.toLowerCase().includes(search.toLowerCase())),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    try {
      e.preventDefault();
      
      if (!groupName.trim()) {
        toast.error("Vui lòng nhập tên nhóm");
        return;
      }
      
      if (invitedUsers.length < 2) {
        toast.error("Nhóm cần ít nhất 2 thành viên");
        return;
      }

      await createConversation(
        "group",
        groupName,
        invitedUsers.map((u) => u._id),
      );

      resetForm();
      setOpen(false);
      toast.success("Tạo nhóm chat thành công!");
    } catch (error) {
      console.error("Lỗi khi tạo nhóm chat:", error);
      toast.error("Không thể tạo nhóm chat. Vui lòng thử lại.");
    }
  };

  const selectedUserIds = invitedUsers.map((u) => u._id);
  const isSubmitDisabled = loading || !groupName.trim() || invitedUsers.length < 2;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        playClickSound();
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          onClick={() => setOpen(true)}
          className="flex z-10 justify-center items-center size-5 rounded-full hover:bg-sidebar-accent transition cursor-pointer"
        >
          <Users className="size-4" />
          <span className="sr-only">Tạo nhóm chat mới</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px] border-none max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Tạo nhóm chat mới</DialogTitle>
          <DialogDescription>
            {invitedUsers.length > 0
              ? `Đã chọn ${invitedUsers.length} thành viên`
              : "Chọn bạn bè và đặt tên nhóm"}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4 flex-1 overflow-hidden" onSubmit={handleSubmit}>
          {/* Group Name Input */}
          <div className="space-y-2">
            <Label htmlFor="group-name" className="text-sm font-semibold">
              Tên nhóm <span className="text-destructive">*</span>
            </Label>
            <Input
              id="group-name"
              placeholder="Nhập tên nhóm của bạn"
              className="glass border-border/50 focus:border-primary/50 transition-smooth"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">{groupName.length}/50</p>
          </div>

          {/* Selected Users Section */}
          {invitedUsers.length > 0 && (
            <SelectedUsersList
              invitedUsers={invitedUsers}
              onRemove={handleRemoveFriend}
            />
          )}

          {/* Search & Friends List */}
          <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
            <Label htmlFor="search-friends" className="text-sm font-semibold">
              Thêm bạn bè <span className="text-destructive">*</span>
            </Label>
            <Input
              id="search-friends"
              placeholder="Tìm theo tên hoặc username..."
              className="glass border-border/50 focus:border-primary/50 transition-smooth"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {/* Friends List - Scrollable */}
            <div className="flex-1 overflow-hidden">
              <InviteSuggestionList
                filteredFriends={filteredFriends}
                onSelect={handleSelectFriend}
                loading={isInitializing || friendsLoading}
                selectedUserIds={selectedUserIds}
              />
            </div>
          </div>

          {/* Error Message if not enough members */}
          {groupName.trim() && invitedUsers.length < 2 && (
            <p className="text-xs text-destructive/80">
              Cần chọn ít nhất 2 thành viên để tạo nhóm
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={isSubmitDisabled}
              className="bg-gradient-chat text-white hover:opacity-90 transition-smooth"
            >
              {loading ? (
                <span>Đang tạo nhóm...</span>
              ) : (
                <>
                  <UserPlus className="size-4 mr-2" />
                  Tạo nhóm chat ({invitedUsers.length})
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
