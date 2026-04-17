import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Bell, Loader2, MessageSquare, Trash2, UserPlus, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFriendStore } from "@/stores/useFriendStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import ReceivedRequests from "../friendRequest/ReceivedRequests";
import SentRequest from "../friendRequest/SentRequest";
import { cn, formatMessageTime } from "@/lib/utils";
import { useChatStore } from "@/stores/useChatStore";
import { Button } from "../ui/button";
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
} from "../ui/alert-dialog";

interface NotificationCenterDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "friend_request":
      return <UserPlus className="size-4 text-primary" />;
    case "new_message":
      return <MessageSquare className="size-4 text-primary" />;
    case "added_to_group":
      return <Users className="size-4 text-primary" />;
    case "conversation_removed":
    case "conversation_deleted":
      return <Trash2 className="size-4 text-destructive" />;
    default:
      return <Bell className="size-4 text-primary" />;
  }
};

const NotificationCenterDialog = ({
  open,
  setOpen,
}: NotificationCenterDialogProps) => {
  const [tab, setTab] = useState<"all" | "received" | "sent">("all");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [highlightedUnreadIds, setHighlightedUnreadIds] = useState<string[]>([]);
  const { getAllFriendRequests } = useFriendStore();
  const { items, clearAllNotifications, markAllAsRead, removeNotification } =
    useNotificationStore();
  const { fetchMessages, setActiveConversation } = useChatStore();

  const allNotifications = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [items],
  );

  useEffect(() => {
    if (!open) return;

    setHighlightedUnreadIds(items.filter((item) => !item.isRead).map((item) => item.id));
    markAllAsRead();
    void getAllFriendRequests();
  }, [getAllFriendRequests, markAllAsRead, open]);

  useEffect(() => {
    if (open) return;

    setConfirmClearOpen(false);
    setIsClearingAll(false);
    setHighlightedUnreadIds([]);
  }, [open]);

  const scrollToMessage = (messageId: string, attempts = 12) => {
    const target = document.getElementById(`message-${messageId}`);

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("ring-2", "ring-primary/60", "ring-offset-2", "ring-offset-background");

      window.setTimeout(() => {
        target.classList.remove(
          "ring-2",
          "ring-primary/60",
          "ring-offset-2",
          "ring-offset-background",
        );
      }, 1800);
      return;
    }

    if (attempts <= 0) return;

    window.setTimeout(() => {
      scrollToMessage(messageId, attempts - 1);
    }, 150);
  };

  const handleNotificationClick = async (
    conversationId?: string,
    messageId?: string,
  ) => {
    if (!conversationId || !messageId || isClearingAll) return;

    setActiveConversation(conversationId);
    await fetchMessages(conversationId);
    setOpen(false);
    scrollToMessage(messageId);
  };

  const handleClearAllNotifications = async () => {
    if (isClearingAll || allNotifications.length === 0) return;

    try {
      setIsClearingAll(true);

      await new Promise((resolve) => window.setTimeout(resolve, 400));
      clearAllNotifications();
      setConfirmClearOpen(false);
    } finally {
      setIsClearingAll(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Thông báo</DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as "all" | "received" | "sent")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">Tất cả</TabsTrigger>
            <TabsTrigger value="received">Đã nhận</TabsTrigger>
            <TabsTrigger value="sent">Đã gửi</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <div className="mb-3 flex justify-end">
              <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={allNotifications.length === 0 || isClearingAll}
                  >
                    {isClearingAll ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    {isClearingAll ? "Đang xóa..." : "Xóa tất cả"}
                  </Button>
                </AlertDialogTrigger>

                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Xóa toàn bộ thông báo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Toàn bộ thông báo trong mục này sẽ bị xóa khỏi danh sách hiện tại.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isClearingAll}>Hủy</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={isClearingAll}
                      onClick={(event) => {
                        event.preventDefault();
                        void handleClearAllNotifications();
                      }}
                    >
                      {isClearingAll ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Đang xóa...
                        </>
                      ) : (
                        "Xác nhận"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {allNotifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có thông báo nào.
                </p>
              ) : (
                allNotifications.map((notification) => {
                  const isHighlighted = highlightedUnreadIds.includes(notification.id);

                  return (
                  <div
                    key={notification.id}
                    className={cn(
                      "relative flex items-start gap-3 overflow-hidden rounded-xl border border-border/60 bg-card/70 p-3 transition-all duration-200",
                      isHighlighted &&
                        "border-primary/40 bg-primary/8 ring-1 ring-primary/20 shadow-lg shadow-primary/10",
                    )}
                  >
                    {isHighlighted && (
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(34,211,238,0.04)_52%,transparent)]" />
                    )}
                    <div className="mt-0.5 rounded-full bg-muted p-2">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void handleNotificationClick(
                          notification.conversationId,
                          notification.messageId,
                        )
                      }
                      className="min-w-0 flex-1 text-left"
                      disabled={isClearingAll}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={cn("font-medium", isHighlighted && "text-foreground")}>
                            {notification.title}
                          </p>
                          {isHighlighted && (
                            <span className="mt-1 inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                              Mới
                            </span>
                          )}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-xs text-muted-foreground",
                            isHighlighted && "text-primary",
                          )}
                        >
                          {formatMessageTime(new Date(notification.createdAt))}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mt-1 text-sm text-muted-foreground",
                          isHighlighted && "text-foreground/85",
                        )}
                      >
                        {notification.message}
                      </p>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 rounded-full"
                      onClick={() => removeNotification(notification.id)}
                      disabled={isClearingAll}
                    >
                      <X className="size-4" />
                      <span className="sr-only">Xóa thông báo</span>
                    </Button>
                  </div>
                )})
              )}
            </div>
          </TabsContent>

          <TabsContent value="received">
            <ReceivedRequests />
          </TabsContent>

          <TabsContent value="sent">
            <SentRequest />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationCenterDialog;
