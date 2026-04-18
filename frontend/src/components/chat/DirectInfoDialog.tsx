import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, FileText, Flag, ImageIcon, Loader2, ShieldBan } from "lucide-react";
import { toast } from "sonner";

import type { Conversation, Message } from "@/types/chat";
import { useChatStore } from "@/stores/useChatStore";
import { cn } from "@/lib/utils";
import {
  appendReport,
  getBlockedUsers,
  isUserBlocked,
  setBlockedUsers,
} from "@/lib/directChatPreferences";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import UserAvatar from "./UserAvatar";
import type { BlockedUser } from "../profile/BlockTab";

interface DirectInfoDialogProps {
  chat: Conversation;
  displayName: string;
  userName?: string;
  avatarUrl?: string;
  bio?: string | null;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const reportReasons = ["Spam", "Quấy rối", "Nội dung xấu", "Giả mạo", "Khác"];

const DirectInfoDialog = ({
  chat,
  displayName,
  userName,
  avatarUrl,
  bio,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: DirectInfoDialogProps) => {
  const { messages } = useChatStore();
  const [internalOpen, setInternalOpen] = useState(false);
  const [mediaExpanded, setMediaExpanded] = useState(false);
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [reportExpanded, setReportExpanded] = useState(true);
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const sharedAssetsLoading = false;
  const [blockReason, setBlockReason] = useState("");
  const [isBlocked, setIsBlocked] = useState(() => isUserBlocked(userName));
  const [reportReason, setReportReason] = useState(reportReasons[0]);
  const [reportDescription, setReportDescription] = useState("");
  const open = controlledOpen ?? internalOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    if (!open) return;
    setIsBlocked(isUserBlocked(userName));
  }, [open, userName]);

  useEffect(() => {
    if (open) return;
    setMediaExpanded(false);
    setFilesExpanded(true);
    setReportExpanded(true);
    setMediaViewerOpen(false);
  }, [open]);

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

  const handleToggleBlock = () => {
    if (!userName) {
      toast.error("Không tìm thấy username để chặn.");
      return;
    }

    const nextBlockedUsers = getBlockedUsers();
    let next: BlockedUser[];

    if (isBlocked) {
      next = nextBlockedUsers.filter(
        (user) => user.userName.trim().toLowerCase() !== userName.trim().toLowerCase(),
      );
      setBlockedUsers(next);
      setIsBlocked(false);
      setBlockReason("");
      toast.success(`Đã bỏ chặn @${userName}`);
      return;
    }

    next = [
      ...nextBlockedUsers,
      {
        userName: userName.trim(),
        reason: blockReason.trim() || undefined,
        createdAt: new Date().toISOString(),
      },
    ];
    setBlockedUsers(next);
    setIsBlocked(true);
    toast.success(`Đã chặn @${userName}`);
  };

  const handleSendReport = () => {
    if (!userName) {
      toast.error("Không tìm thấy username để báo cáo.");
      return;
    }

    if (!reportDescription.trim()) {
      toast.error("Nhập mô tả báo cáo.");
      return;
    }

    appendReport({
      conversationId: chat._id,
      targetUserName: userName.trim(),
      reason: reportReason,
      description: reportDescription.trim(),
      createdAt: new Date().toISOString(),
    });

    setReportDescription("");
    setReportReason(reportReasons[0]);
    toast.success("Đã gửi báo cáo");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}

      <DialogContent className="max-h-[88vh] sm:max-w-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Thiết lập đoạn chat</DialogTitle>
          <DialogDescription>
            Quản lý hồ sơ công khai, ảnh đã gửi, file đã gửi và báo cáo cho cuộc trò chuyện
            này.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(88vh-96px)] space-y-5 overflow-y-auto pr-2">
          <section className="flex items-center gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <UserAvatar
              type="sidebar"
              name={displayName}
              avatarUrl={avatarUrl}
              className="size-16 text-xl"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{displayName}</p>
              <p className="truncate text-sm text-muted-foreground">@{userName || "unknown"}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {bio?.trim() || "Người dùng này chưa cập nhật giới thiệu."}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-muted/10">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() => setMediaExpanded((state) => !state)}
            >
              <div>
                <p className="text-sm font-semibold">Ảnh đã gửi</p>
                <p className="text-xs text-muted-foreground">
                  {sharedMedia.length > 0
                    ? `${sharedMedia.length} ảnh đã được chia sẻ trong đoạn chat này.`
                    : "Xem lại các hình ảnh đã gửi trong đoạn chat này."}
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
                    Đang tải ảnh...
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
                            alt="Ảnh đã chia sẻ trong direct chat"
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                          />
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
                          <DialogTitle>Ảnh đã chia sẻ</DialogTitle>
                          <DialogDescription>
                            Tất cả ảnh hiện đang lấy từ lịch sử của direct chat này.
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
                                  alt="Ảnh đã chia sẻ trong direct chat"
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
                      Chưa có ảnh nào được chia sẻ trong đoạn chat này
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
                <p className="text-sm font-semibold">File đã gửi</p>
                <p className="text-xs text-muted-foreground">
                  Khu vực này sẵn sàng cho danh sách file khi direct chat hỗ trợ file đính
                  kèm.
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
                    Chưa có file nào trong đoạn chat này
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border/60 bg-muted/10">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() => setReportExpanded((state) => !state)}
            >
              <div>
                <p className="text-sm font-semibold">Báo cáo hoặc chặn</p>
                <p className="text-xs text-muted-foreground">
                  Quản lý hành động an toàn cho direct chat này.
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 text-muted-foreground transition-transform duration-200",
                  reportExpanded && "rotate-180",
                )}
              />
            </button>

            {reportExpanded && (
              <div className="space-y-4 border-t border-border/60 px-4 py-4">
                <div className="rounded-xl border border-border/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Trạng thái chặn</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isBlocked
                          ? `@${userName} hiện đang nằm trong danh sách chặn của bạn.`
                          : "Bạn có thể chặn người này ngay từ direct chat."}
                      </p>
                    </div>
                    <Badge variant={isBlocked ? "destructive" : "secondary"}>
                      {isBlocked ? "Đã chặn" : "Chưa chặn"}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    {!isBlocked ? (
                      <>
                        <Label htmlFor="direct-block-reason">Lý do chặn</Label>
                        <Textarea
                          id="direct-block-reason"
                          value={blockReason}
                          onChange={(event) => setBlockReason(event.target.value)}
                          placeholder="Spam, làm phiền, giả mạo..."
                          className="min-h-20"
                        />
                      </>
                    ) : null}

                    <Button
                      type="button"
                      variant={isBlocked ? "outline" : "destructive"}
                      className="w-full"
                      onClick={handleToggleBlock}
                    >
                      <ShieldBan className="mr-2 size-4" />
                      {isBlocked ? "Bỏ chặn người dùng" : "Chặn người dùng"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-sm font-medium">Gửi báo cáo</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Báo cáo này sẽ được lưu kèm username và cuộc trò chuyện hiện tại.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {reportReasons.map((reason) => (
                      <Button
                        key={reason}
                        type="button"
                        variant={reportReason === reason ? "default" : "outline"}
                        onClick={() => setReportReason(reason)}
                      >
                        {reason}
                      </Button>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label htmlFor="direct-report-description">Mô tả báo cáo</Label>
                    <Textarea
                      id="direct-report-description"
                      value={reportDescription}
                      onChange={(event) => setReportDescription(event.target.value)}
                      placeholder="Mô tả chi tiết hành vi vi phạm..."
                      className="min-h-24"
                    />
                  </div>

                  <Button type="button" className="mt-4 w-full" onClick={handleSendReport}>
                    <Flag className="mr-2 size-4" />
                    Gửi báo cáo
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DirectInfoDialog;
