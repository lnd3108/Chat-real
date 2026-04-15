import { useEffect, useMemo, useState } from "react";
import { UserMinus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { chatServices } from "@/services/chatServices";
import { useFriendStore } from "@/stores/useFriendStore";
import type { Conversation } from "@/types/chat";
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

interface GroupMemberManagerDialogProps {
  chat: Conversation;
}

const getParticipantId = (participant: any) =>
  typeof participant?.userId === "string"
    ? participant.userId
    : participant?.userId?._id ?? participant?._id ?? "";

const getParticipantProfile = (participant: any) =>
  participant?.userId && typeof participant.userId === "object"
    ? participant.userId
    : participant;

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
      chat.participants.map((participant) => {
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
      toast.success(`Đã thêm ${friend.displayName} vào nhóm`);
      setSearch("");
    } catch (error) {
      console.error("addGroupMembers failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Không thể thêm thành viên vào nhóm";
      toast.error(message);
    } finally {
      setAddingIds((state) => state.filter((id) => id !== friend._id));
    }
  };

  const handleRemove = async (memberId: string, displayName: string) => {
    try {
      setRemovingId(memberId);
      await chatServices.removeGroupMember(chat._id, memberId);
      toast.success(`Đã xóa ${displayName} khỏi nhóm`);
    } catch (error) {
      console.error("removeGroupMember failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Không thể xóa thành viên khỏi nhóm";
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
          <span className="sr-only">Quản lý thành viên nhóm</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quản lý thành viên</DialogTitle>
          <DialogDescription>
            Chủ nhóm có thể thêm bạn bè vào nhóm hoặc xóa thành viên hiện tại.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Thêm thành viên</h3>
            <Input
              placeholder="Tìm bạn bè để thêm..."
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
                          <p className="text-xs text-muted-foreground">
                            @{friend.userName}
                          </p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleAdd(friend)}
                        disabled={addingIds.includes(friend._id)}
                      >
                        <UserPlus className="mr-2 size-4" />
                        Thêm
                      </Button>
                    </div>
                  ))}

                {!loading && availableFriends.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Không có bạn bè phù hợp để thêm.
                  </p>
                )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Thành viên hiện tại</h3>

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
                        avatarUrl={member.avatarUrl}
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
                        Xóa
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
