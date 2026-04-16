import { useEffect, useMemo, useState } from "react";
import { UserMinus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { chatServices } from "@/services/chatServices";
import { useFriendStore } from "@/stores/useFriendStore";
import type { Conversation, Participant } from "@/types/chat";
import type { Friend } from "@/types/user";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import UserAvatar from "./UserAvatar";
import { getParticipantId, getParticipantProfile } from "@/lib/chatParticipants";

interface GroupMemberManagerDialogProps {
  chat: Conversation;
}

const GroupMemberManagerDialog = ({ chat }: GroupMemberManagerDialogProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addingIds, setAddingIds] = useState<string[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { friends, getFriends, loading } = useFriendStore();

  useEffect(() => {
    if (!open) return;
    void getFriends();
  }, [open, getFriends]);

  const memberIds = useMemo(
    () => new Set(chat.participants.map((participant) => getParticipantId(participant))),
    [chat.participants],
  );

  const availableFriends = useMemo(
    () =>
      friends.filter(
        (friend) =>
          !memberIds.has(friend._id) &&
          friend.displayName.toLowerCase().includes(search.toLowerCase()),
      ),
    [friends, memberIds, search],
  );

  const members = useMemo(
    () =>
      chat.participants.map((participant: Participant) => {
        const profile = getParticipantProfile(participant);
        return {
          _id: getParticipantId(participant),
          displayName: profile?.displayName ?? "ChatRealTime",
          avatarUrl: profile?.avatarUrl,
        };
      }),
    [chat.participants],
  );

  const handleAdd = async (friend: Friend) => {
    try {
      setAddingIds((state) => [...state, friend._id]);
      await chatServices.addGroupMembers(chat._id, [friend._id]);
      toast.success(`Da them ${friend.displayName} vao nhom`);
      setSearch("");
    } catch (error) {
      console.error("addGroupMembers failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Khong the them thanh vien vao nhom";
      toast.error(message);
    } finally {
      setAddingIds((state) => state.filter((id) => id !== friend._id));
    }
  };

  const handleRemove = async (memberId: string, displayName: string) => {
    try {
      setRemovingId(memberId);
      await chatServices.removeGroupMember(chat._id, memberId);
      toast.success(`Da xoa ${displayName} khoi nhom`);
    } catch (error) {
      console.error("removeGroupMember failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Khong the xoa thanh vien khoi nhom";
      toast.error(message);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Users className="size-4" />
          <span className="sr-only">Quan ly thanh vien nhom</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quan ly thanh vien</DialogTitle>
          <DialogDescription>
            Chu nhom co the them ban be vao nhom hoac xoa thanh vien hien tai.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Them thanh vien</h3>
            <Input
              placeholder="Tim ban be de them..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="max-h-48 space-y-2 overflow-y-auto pr-2">
              {!loading &&
                availableFriends.map((friend) => (
                  <div
                    key={friend._id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        type="sidebar"
                        name={friend.displayName}
                        avatarUrl={friend.avatarUrl}
                      />
                      <div>
                        <p className="text-sm font-medium">{friend.displayName}</p>
                        <p className="text-xs text-muted-foreground">@{friend.userName}</p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleAdd(friend)}
                      disabled={addingIds.includes(friend._id)}
                    >
                      <UserPlus className="mr-2 size-4" />
                      Them
                    </Button>
                  </div>
                ))}

              {!loading && availableFriends.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Khong co ban be phu hop de them.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Thanh vien hien tai</h3>

            <div className="max-h-56 space-y-2 overflow-y-auto pr-2">
              {members.map((member) => (
                <div
                  key={member._id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      type="sidebar"
                      name={member.displayName}
                      avatarUrl={member.avatarUrl ?? undefined}
                    />
                    <p className="text-sm font-medium">{member.displayName}</p>
                  </div>

                  {member._id === chat.group?.createdBy ? (
                    <span className="text-xs text-muted-foreground">Admin</span>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemove(member._id, member.displayName)}
                      disabled={removingId === member._id}
                    >
                      <UserMinus className="mr-2 size-4" />
                      Xoa
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupMemberManagerDialog;
