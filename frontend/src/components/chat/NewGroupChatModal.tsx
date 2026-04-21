import { useState } from "react";
import { getErrorMeta, logger } from "@/lib/logger";
import { UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { playClickSound } from "@/lib/sound";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import type { Friend } from "@/types/user";
import InviteSuggestionList from "../newGroupChat/InviteSuggestionList";
import SelectedUsersList from "../newGroupChat/SelectedUsersList";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

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
        toast.error("Vui long nhap ten nhom");
        return;
      }

      if (invitedUsers.length < 2) {
        toast.error("Nhom can it nhat 2 thanh vien");
        return;
      }

      await createConversation(
        "group",
        groupName,
        invitedUsers.map((user) => user._id),
      );

      resetForm();
      setOpen(false);
      toast.success("Tao nhom chat thanh cong!");
    } catch (error) {
      logger.error("Loi khi tao nhom chat", getErrorMeta(error));
      toast.error("Khong the tao nhom chat. Vui long thu lai.");
    }
  };

  const selectedUserIds = invitedUsers.map((user) => user._id);
  const isSubmitDisabled = loading || !groupName.trim() || invitedUsers.length < 2;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          onClick={() => setOpen(true)}
          className="flex z-10 items-center justify-center size-5 rounded-full hover:bg-sidebar-accent transition cursor-pointer"
        >
          <Users className="size-4" />
          <span className="sr-only">Tao nhom chat moi</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px] border-none max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Tao nhom chat moi</DialogTitle>
          <DialogDescription>
            {invitedUsers.length > 0
              ? `Da chon ${invitedUsers.length} thanh vien`
              : "Chon ban be va dat ten nhom"}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-1 flex-col gap-4 overflow-hidden" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="group-name" className="text-sm font-semibold">
              Ten nhom <span className="text-destructive">*</span>
            </Label>
            <Input
              id="group-name"
              placeholder="Nhap ten nhom cua ban"
              className="glass border-border/50 focus:border-primary/50 transition-smooth"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">{groupName.length}/50</p>
          </div>

          {invitedUsers.length > 0 && (
            <SelectedUsersList invitedUsers={invitedUsers} onRemove={handleRemoveFriend} />
          )}

          <div className="flex flex-1 flex-col space-y-2 overflow-hidden">
            <Label htmlFor="search-friends" className="text-sm font-semibold">
              Them ban be <span className="text-destructive">*</span>
            </Label>
            <Input
              id="search-friends"
              placeholder="Tim theo ten hoac username..."
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
            <p className="text-xs text-destructive/80">Can chon it nhat 2 thanh vien de tao nhom</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Huy
            </Button>
            <Button
              type="submit"
              disabled={isSubmitDisabled}
              className="bg-gradient-chat text-white hover:opacity-90 transition-smooth"
            >
              {loading ? (
                <span>Dang tao nhom...</span>
              ) : (
                <>
                  <UserPlus className="mr-2 size-4" />
                  Tao nhom chat ({invitedUsers.length})
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
