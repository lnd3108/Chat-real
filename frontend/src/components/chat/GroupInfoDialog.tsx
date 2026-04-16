import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Camera, Loader2, UserMinus, UserPlus } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { chatServices } from "@/services/chatServices";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import type { Conversation, Participant } from "@/types/chat";
import type { Friend } from "@/types/user";
import { getParticipantId, getParticipantProfile } from "@/lib/chatParticipants";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import GroupChatAvatar from "./GroupChatAvatar";
import UserAvatar from "./UserAvatar";

interface GroupInfoDialogProps {
  chat: Conversation;
  trigger: ReactNode;
}

const GroupInfoDialog = ({ chat, trigger }: GroupInfoDialogProps) => {
  const { user } = useAuthStore();
  const { friends, getFriends, loading } = useFriendStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [addingIds, setAddingIds] = useState<string[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isOwner = chat.group?.createdBy === user?._id;

  useEffect(() => {
    if (!open || !isOwner) return;
    void getFriends();
  }, [getFriends, isOwner, open]);

  const members = useMemo(() => {
    const mapped = chat.participants.map((participant: Participant) => {
      const profile = getParticipantProfile(participant);
      const memberId = getParticipantId(participant);
      const memberIsOwner = memberId === chat.group?.createdBy;

      return {
        _id: memberId,
        displayName: profile?.displayName ?? "ChatRealTime",
        avatarUrl: profile?.avatarUrl ?? undefined,
        roleLabel: memberIsOwner ? "Chủ nhóm" : "Thành viên",
        isOwner: memberIsOwner,
      };
    });

    return mapped.sort((a, b) => Number(b.isOwner) - Number(a.isOwner));
  }, [chat.group?.createdBy, chat.participants]);

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

  const handleOpenFilePicker = () => {
    if (avatarUploading) return;
    fileInputRef.current?.click();
  };

  const handleGroupAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      setAvatarUploading(true);
      const updatedConversation = await chatServices.uploadGroupAvatar(chat._id, file);

      useChatStore.getState().updateConversation({
        _id: updatedConversation._id,
        group: updatedConversation.group,
        participants: updatedConversation.participants,
        moveToTop: false,
      });

      toast.success("Đã cập nhật ảnh đại diện nhóm");
    } catch (error) {
      console.error("uploadGroupAvatar failed", error);
      toast.error("Không thể cập nhật ảnh đại diện nhóm");
    } finally {
      setAvatarUploading(false);
    }
  };

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
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="max-h-[88vh] sm:max-w-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Thông tin nhóm</DialogTitle>
          <DialogDescription>
            Xem thành viên, vai trò trong nhóm và cập nhật ảnh đại diện nhóm ngay tại đây.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(88vh-96px)] space-y-5 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
          <section className="flex items-center gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <GroupChatAvatar
              participants={chat.participants}
              type="sidebar"
              avatarUrl={chat.group?.avatarUrl}
              groupName={chat.group?.name}
              isUploading={avatarUploading}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{chat.group?.name}</p>
              <p className="text-sm text-muted-foreground">
                Tổng số thành viên: {chat.participants.length}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-dashed border-border/70 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Ảnh đại diện nhóm</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mọi thành viên đều có thể thay ảnh đại diện nhóm.
                </p>
              </div>

              <Button
                type="button"
                onClick={handleOpenFilePicker}
                disabled={avatarUploading}
              >
                {avatarUploading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Đang tải ảnh...
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 size-4" />
                    Thay ảnh
                  </>
                )}
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleGroupAvatarChange}
            />
          </section>

          {isOwner && (
            <section className="space-y-3 rounded-2xl border border-border/60 p-4">
              <div>
                <p className="text-sm font-semibold">Quản lý thành viên</p>
                <p className="text-sm text-muted-foreground">
                  Chỉ chủ nhóm mới thấy và sử dụng được khu vực này.
                </p>
              </div>

              <Input
                placeholder="Tìm bạn bè để thêm vào nhóm..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {!loading &&
                  availableFriends.map((friend) => (
                    <div
                      key={friend._id}
                      className="flex items-center justify-between rounded-xl border px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar
                          type="sidebar"
                          name={friend.displayName}
                          avatarUrl={friend.avatarUrl}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {friend.displayName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
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
          )}

          <section className="space-y-3 rounded-2xl border border-border/60 p-4">
            <div>
              <p className="text-sm font-semibold">Thành viên trong nhóm</p>
              <p className="text-sm text-muted-foreground">
                Danh sách thành viên và vai trò hiện tại.
              </p>
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {members.map((member) => (
                <div
                  key={member._id}
                  className="flex items-center justify-between rounded-xl border px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                      type="sidebar"
                      name={member.displayName}
                      avatarUrl={member.avatarUrl}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{member.displayName}</p>
                      <p className="text-xs text-muted-foreground">{member.roleLabel}</p>
                    </div>
                  </div>

                  {isOwner && !member.isOwner ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemove(member._id, member.displayName)}
                      disabled={removingId === member._id}
                    >
                      <UserMinus className="mr-2 size-4" />
                      Xóa
                    </Button>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">
                      {member.roleLabel}
                    </span>
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

export default GroupInfoDialog;
