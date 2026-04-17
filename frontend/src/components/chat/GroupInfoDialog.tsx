import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Camera,
  ChevronDown,
  FileText,
  ImageIcon,
  Loader2,
  LogOut,
  Trash2,
  TriangleAlert,
  UserMinus,
  UserPlus,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { chatServices } from "@/services/chatServices";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import type { Conversation, Message, Participant } from "@/types/chat";
import type { Friend } from "@/types/user";
import { getParticipantId, getParticipantProfile } from "@/lib/chatParticipants";
import { cn } from "@/lib/utils";
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
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const GroupInfoDialog = ({
  chat,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: GroupInfoDialogProps) => {
  const { user } = useAuthStore();
  const { deleteOrLeaveGroupConversation, fetchMessages, messages } = useChatStore();
  const { friends, getFriends, loading } = useFriendStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dangerActionRef = useRef<HTMLDivElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [addingIds, setAddingIds] = useState<string[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"leave" | "delete" | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [mediaExpanded, setMediaExpanded] = useState(true);
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [sharedAssetsLoading, setSharedAssetsLoading] = useState(false);
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const isOwner = chat.group?.createdBy === user?._id;

  useEffect(() => {
    if (!open || !isOwner) return;
    void getFriends();
  }, [getFriends, isOwner, open]);

  useEffect(() => {
    if (open) return;
    setActionType(null);
    setSubmittingAction(false);
    setMediaViewerOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const loadConversationHistory = async () => {
      try {
        setSharedAssetsLoading(true);

        while (true) {
          const current = useChatStore.getState().messages[chat._id];
          const hasLoadedOnce = !!current;
          const hasMore = current?.nextCursor !== null;

          if (hasLoadedOnce && !hasMore) break;

          await fetchMessages(chat._id);

          const nextState = useChatStore.getState().messages[chat._id];
          if (nextState?.nextCursor === null) break;
          if (!nextState && hasLoadedOnce) break;
        }
      } catch (error) {
        console.error("loadConversationHistory failed", error);
      } finally {
        setSharedAssetsLoading(false);
      }
    };

    void loadConversationHistory();
  }, [chat._id, fetchMessages, open]);

  useEffect(() => {
    if (!open || !actionType) return;

    const frame = window.requestAnimationFrame(() => {
      dangerActionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });

      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [actionType, open]);

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

  const sharedMedia = useMemo(
    () =>
      (messages[chat._id]?.items ?? [])
        .filter(
          (message): message is Message & { imgUrl: string } =>
            !!message.imgUrl && !message.isDeletedForEveryone && !message.isHiddenForMe,
        )
        .sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [chat._id, messages],
  );

  const previewMedia = sharedMedia.slice(0, 8);

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

  const handleConfirmDangerAction = async () => {
    if (!actionType || submittingAction) return;

    if (actionType === "leave" && isOwner) {
      toast.warning("Không thể rời nhóm vì bạn là admin. Hãy xóa nhóm nếu muốn kết thúc nhóm này.");
      return;
    }

    try {
      setSubmittingAction(true);
      await deleteOrLeaveGroupConversation(chat._id);
      handleOpenChange(false);
    } finally {
      setSubmittingAction(false);
      setActionType(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}

      <DialogContent className="max-h-[88vh] sm:max-w-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Thông tin nhóm</DialogTitle>
          <DialogDescription>
            Xem thành viên, vai trò trong nhóm và cập nhật ảnh đại diện nhóm ngay tại đây.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollContainerRef}
          className="max-h-[calc(88vh-96px)] space-y-5 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent"
        >
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

          <section className="rounded-2xl border border-border/60 bg-muted/10">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() => setMediaExpanded((state) => !state)}
            >
              <div>
                <p className="text-sm font-semibold">Ảnh/Video</p>
                <p className="text-xs text-muted-foreground">
                  {sharedMedia.length > 0
                    ? `${sharedMedia.length} mục đã được chia sẻ trong hội thoại này.`
                    : "Xem ảnh và video đã được chia sẻ trong hội thoại này."}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 text-muted-foreground transition-transform duration-200",
                  mediaExpanded && "rotate-180",
                )}
              />
            </button>

            {mediaExpanded && (
              <div className="border-t border-border/60 px-4 py-4">
                {sharedAssetsLoading ? (
                  <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Đang tải ảnh/video...
                  </div>
                ) : previewMedia.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-3">
                      {previewMedia.map((media) => (
                        <button
                          key={media._id}
                          type="button"
                          className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted"
                          onClick={() => setMediaViewerOpen(true)}
                        >
                          <img
                            src={media.imgUrl}
                            alt="Ảnh đã được chia sẻ trong nhóm"
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      onClick={() => setMediaViewerOpen(true)}
                    >
                      Xem tất cả
                    </Button>

                    <Dialog open={mediaViewerOpen} onOpenChange={setMediaViewerOpen}>
                      <DialogContent className="max-h-[88vh] sm:max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Ảnh/Video đã chia sẻ</DialogTitle>
                          <DialogDescription>
                            Tất cả ảnh hiện đang lấy được từ lịch sử hội thoại của nhóm này.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="max-h-[65vh] overflow-y-auto pr-2">
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                            {sharedMedia.map((media) => (
                              <a
                                key={`viewer-${media._id}`}
                                href={media.imgUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="group block overflow-hidden rounded-xl border border-border/60 bg-muted"
                              >
                                <img
                                  src={media.imgUrl}
                                  alt="Ảnh đã được chia sẻ trong nhóm"
                                  className="aspect-square h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                ) : (
                  <div className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-xl bg-background/40 px-4 py-6 text-center">
                    <ImageIcon className="size-6 text-muted-foreground" />
                    <p className="max-w-xs text-sm leading-6 text-muted-foreground">
                      Chưa có Ảnh/Video được chia sẻ trong hội thoại này
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border/60 bg-muted/10">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() => setFilesExpanded((state) => !state)}
            >
              <div>
                <p className="text-sm font-semibold">File</p>
                <p className="text-xs text-muted-foreground">
                  Các tệp đính kèm sẽ xuất hiện tại đây khi cuộc trò chuyện hỗ trợ file.
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 text-muted-foreground transition-transform duration-200",
                  filesExpanded && "rotate-180",
                )}
              />
            </button>

            {filesExpanded && (
              <div className="border-t border-border/60 px-4 py-4">
                <div className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-xl bg-background/40 px-4 py-6 text-center">
                  <FileText className="size-6 text-muted-foreground" />
                  <p className="max-w-xs text-sm leading-6 text-muted-foreground">
                    Chưa có File được chia sẻ trong hội thoại này
                  </p>
                </div>
              </div>
            )}
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

          <section className="space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Rời nhóm hoặc xóa nhóm</p>
              <p className="text-sm text-muted-foreground">
                {isOwner
                  ? "Bạn là chủ nhóm. Bạn có thể xóa nhóm, nhưng không thể rời nhóm khi vẫn còn là admin."
                  : "Bạn có thể rời khỏi nhóm này bất cứ lúc nào."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-border/70"
                onClick={() => setActionType("leave")}
              >
                <LogOut className="mr-2 size-4" />
                Rời nhóm
              </Button>

              {isOwner && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setActionType("delete")}
                >
                  <Trash2 className="mr-2 size-4" />
                  Xóa nhóm
                </Button>
              )}
            </div>

            {actionType && (
              <div
                ref={dangerActionRef}
                className="rounded-xl border border-destructive/30 bg-background/80 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-destructive/10 p-2 text-destructive">
                    <TriangleAlert className="size-4" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    {actionType === "delete" ? (
                      <>
                        <div>
                          <p className="text-sm font-semibold">Xác nhận xóa nhóm</p>
                          <p className="text-sm text-muted-foreground">
                            Nhóm sẽ bị xóa vĩnh viễn cho tất cả thành viên và không thể khôi phục.
                          </p>
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setActionType(null)}
                            disabled={submittingAction}
                          >
                            Hủy
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={handleConfirmDangerAction}
                            disabled={submittingAction}
                          >
                            {submittingAction ? (
                              <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Đang xóa...
                              </>
                            ) : (
                              "Xác nhận"
                            )}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="text-sm font-semibold">
                            {isOwner ? "Không thể rời nhóm" : "Xác nhận rời nhóm"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {isOwner
                              ? "Không thể rời nhóm vì bạn là admin. Bạn cần xóa nhóm nếu muốn kết thúc nhóm này."
                              : "Sau khi rời nhóm, cuộc trò chuyện này sẽ bị xóa khỏi danh sách của bạn."}
                          </p>
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setActionType(null)}
                            disabled={submittingAction}
                          >
                            Hủy
                          </Button>
                          <Button
                            type="button"
                            variant={isOwner ? "secondary" : "destructive"}
                            onClick={handleConfirmDangerAction}
                            disabled={isOwner || submittingAction}
                          >
                            {submittingAction ? (
                              <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Đang xử lý...
                              </>
                            ) : (
                              "Xác nhận"
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupInfoDialog;
