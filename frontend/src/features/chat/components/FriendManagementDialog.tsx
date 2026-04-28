import { useEffect, useMemo, useState } from "react";
import { getErrorMeta, logger } from "@/shared/lib/logger";
import {
  Loader2,
  MessageCircle,
  ShieldBan,
  UserRound,
  UserRoundMinus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { playClickSound } from "@/features/settings/lib/sound";
import { userService } from "@/features/settings/services/userService";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import { useFriendStore } from "@/features/friend/stores/useFriendStore";
import type { BlockedUser, Friend } from "@/shared/types/user";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import UserAvatar from "@/features/chat/components/UserAvatar";

const FriendManagementDialog = () => {
  const [open, setOpen] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [processingBlockId, setProcessingBlockId] = useState<string | null>(null);
  const [processingRemoveId, setProcessingRemoveId] = useState<string | null>(null);
  const { friends, getFriends, removeFriend, loading } = useFriendStore();
  const { createConversation } = useChatStore();

  useEffect(() => {
    if (!open) return;

    void getFriends();
    void (async () => {
      try {
        setLoadingBlocked(true);
        const nextBlockedUsers = await userService.getBlockedUsers();
        setBlockedUsers(nextBlockedUsers);
      } catch (error) {
        logger.error("Loi tai danh sach chan", getErrorMeta(error));
      } finally {
        setLoadingBlocked(false);
      }
    })();
  }, [getFriends, open]);

  const blockedMap = useMemo(
    () => new Set(blockedUsers.map((user) => user._id)),
    [blockedUsers],
  );

  const handleToggleBlock = async (friend: Friend) => {
    const isBlocked = blockedMap.has(friend._id);

    try {
      setProcessingBlockId(friend._id);
      const nextBlockedUsers = isBlocked
        ? await userService.unblockUser(friend._id)
        : await userService.blockUser(friend._id);

      setBlockedUsers(nextBlockedUsers);
      toast.success(
        isBlocked ? `Đã bỏ chặn @${friend.userName}` : `Đã chặn @${friend.userName}`,
      );
    } catch (error) {
      logger.error("Loi cap nhat trang thai chan", getErrorMeta(error));
      toast.error("Không thể cập nhật trạng thái chặn lúc này.");
    } finally {
      setProcessingBlockId(null);
    }
  };

  const handleCreateDirectConversation = async (friend: Friend) => {
    try {
      await createConversation("direct", "", [friend._id]);
      setOpen(false);
    } catch (error) {
      logger.error("Loi mo doan chat direct", getErrorMeta(error));
      toast.error("Không thể mở đoạn chat lúc này.");
    }
  };

  const handleRemoveFriend = async (friend: Friend) => {
    try {
      setProcessingRemoveId(friend._id);
      const message = await removeFriend(friend._id);
      toast.success(message);
    } catch (error) {
      logger.error("Loi huy ket ban", getErrorMeta(error));
      toast.error("Không thể hủy kết bạn lúc này.");
    } finally {
      setProcessingRemoveId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        playClickSound();
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="flex z-10 justify-center items-center size-5 rounded-full hover:bg-sidebar-accent transition cursor-pointer"
        >
          <Users className="size-4" />
          <span className="sr-only">Danh sách bạn bè</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-border/40 bg-card/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-2xl">
        <DialogHeader className="border-b border-border/40 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <UserRound className="size-5" />
            Danh sách bạn bè
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Quản lý bạn bè đã kết bạn. Nếu hủy kết bạn, đoạn chat trực tiếp hiện có giữa
            hai người cũng sẽ bị xóa.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {loading || loadingBlocked ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Đang tải danh sách bạn bè...
            </div>
          ) : null}

          {!loading && !loadingBlocked && friends.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
              Bạn chưa có bạn bè nào để quản lý.
            </div>
          ) : null}

          {!loading && !loadingBlocked && friends.length > 0 ? (
            <div className="space-y-3">
              {friends.map((friend) => {
                const isBlocked = blockedMap.has(friend._id);
                const isProcessingBlock = processingBlockId === friend._id;
                const isProcessingRemove = processingRemoveId === friend._id;
                const isBusy = isProcessingBlock || isProcessingRemove;

                return (
                  <div
                    key={friend._id}
                    className="rounded-2xl border border-border/60 bg-background/45 p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        className="flex min-w-0 items-center gap-3 text-left transition-opacity hover:opacity-85"
                        onClick={() => void handleCreateDirectConversation(friend)}
                        disabled={isBusy}
                      >
                        <UserAvatar
                          type="sidebar"
                          name={friend.displayName}
                          avatarUrl={friend.avatarUrl}
                          className="size-11"
                        />

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{friend.displayName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            @{friend.userName}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {isBlocked ? "Người này đang bị chặn" : "Nhấn để mở direct chat"}
                          </p>
                        </div>
                      </button>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={isBlocked ? "outline" : "destructive"}
                          className="rounded-xl"
                          onClick={() => void handleToggleBlock(friend)}
                          disabled={isBusy}
                        >
                          {isProcessingBlock ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <ShieldBan className="size-4" />
                          )}
                          {isBlocked ? "Bỏ chặn" : "Chặn"}
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={isBusy}
                            >
                              <UserRoundMinus className="size-4" />
                              Hủy kết bạn
                            </Button>
                          </AlertDialogTrigger>

                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Hủy kết bạn với {friend.displayName}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Thao tác này sẽ xóa quan hệ bạn bè giữa hai người và xóa luôn
                                đoạn chat trực tiếp hiện có. Hành động này không thể hoàn tác.
                              </AlertDialogDescription>
                            </AlertDialogHeader>

                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isProcessingRemove}>
                                Đóng
                              </AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                disabled={isProcessingRemove}
                                onClick={() => {
                                  void handleRemoveFriend(friend);
                                }}
                              >
                                {isProcessingRemove ? (
                                  <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Đang hủy...
                                  </>
                                ) : (
                                  "Xác nhận hủy kết bạn"
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <Button
                          type="button"
                          variant="secondary"
                          className="rounded-xl"
                          onClick={() => void handleCreateDirectConversation(friend)}
                          disabled={isBusy}
                        >
                          <MessageCircle className="size-4" />
                          Nhắn tin
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FriendManagementDialog;
