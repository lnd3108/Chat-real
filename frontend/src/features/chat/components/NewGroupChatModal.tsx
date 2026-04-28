import { useState } from "react";
import { getErrorMeta, logger } from "@/shared/lib/logger";
import { UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { playClickSound } from "@/features/settings/lib/sound";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import { useFriendStore } from "@/features/friend/stores/useFriendStore";
import type { Friend } from "@/shared/types/user";
import InviteSuggestionList from "@/features/chat/components/newGroupChat/InviteSuggestionList";
import SelectedUsersList from "@/features/chat/components/newGroupChat/SelectedUsersList";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const NewGroupChatModal = () => {
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const { friends, getFriends, loading: friendsLoading } = useFriendStore();
  const [invitedUsers, setInvitedUsers] = useState<Friend[]>([]);
  const [open, setOpen] = useState(false);
  const { loading, createConversation } = useChatStore();

  const resetForm = () => {
    setGroupName("");
    setSearch("");
    setInvitedUsers([]);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    playClickSound();
    setOpen(nextOpen);

    if (!nextOpen) {
      resetForm();
      return;
    }

    if (friends.length === 0) {
      void getFriends();
    }
  };

  const handleSelectFriend = (friend: Friend) => {
    const isSelected = invitedUsers.some((user) => user._id === friend._id);
    setInvitedUsers(
      isSelected
        ? invitedUsers.filter((user) => user._id !== friend._id)
        : [...invitedUsers, friend],
    );
  };

  const handleRemoveFriend = (user: Friend) => {
    setInvitedUsers(invitedUsers.filter((item) => item._id !== user._id));
  };

  const filteredFriends = friends.filter(
    (friend) =>
      !invitedUsers.some((user) => user._id === friend._id) &&
      (friend.displayName.toLowerCase().includes(search.toLowerCase()) ||
        friend.userName.toLowerCase().includes(search.toLowerCase())),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
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
        invitedUsers.map((user) => user._id),
      );

      resetForm();
      setOpen(false);
      toast.success("Tạo nhóm chat thành công!");
    } catch (error) {
      logger.error(" lỗi khi tạo nhóm chat", getErrorMeta(error));
      toast.error("Không thể tạo nhóm chat. Vui lòng thử lại.");
    }
  };

  const selectedUserIds = invitedUsers.map((user) => user._id);
  const isSubmitDisabled =
    loading || !groupName.trim() || invitedUsers.length < 2;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          onClick={() => setOpen(true)}
          className="flex z-10 items-center justify-center size-5 rounded-full hover:bg-sidebar-accent transition cursor-pointer"
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
              : "Chọn bạn bè và đặt tên nhóm của bạn."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-1 flex-col gap-4 overflow-hidden"
          onSubmit={handleSubmit}
        >
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
            <p className="text-xs text-muted-foreground">
              {groupName.length}/50
            </p>
          </div>

          {invitedUsers.length > 0 && (
            <SelectedUsersList
              invitedUsers={invitedUsers}
              onRemove={handleRemoveFriend}
            />
          )}

          <div className="flex flex-1 flex-col space-y-2 overflow-hidden">
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

            <div className="flex-1 overflow-hidden">
              <InviteSuggestionList
                filteredFriends={filteredFriends}
                onSelect={handleSelectFriend}
                loading={friendsLoading}
                selectedUserIds={selectedUserIds}
              />
            </div>
          </div>

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
                  <UserPlus className="mr-2 size-4" />
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
