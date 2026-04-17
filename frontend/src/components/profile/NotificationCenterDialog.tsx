import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Bell, MessageSquare, Trash2, UserPlus, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFriendStore } from "@/stores/useFriendStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import ReceivedRequests from "../friendRequest/ReceivedRequests";
import SentRequest from "../friendRequest/SentRequest";
import { formatMessageTime } from "@/lib/utils";
import { useChatStore } from "@/stores/useChatStore";
import { Button } from "../ui/button";

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
  const { getAllFriendRequests } = useFriendStore();
  const { items, markAllAsRead, removeNotification } = useNotificationStore();
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

    markAllAsRead();
    void getAllFriendRequests();
  }, [getAllFriendRequests, markAllAsRead, open]);

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
    if (!conversationId || !messageId) return;

    setActiveConversation(conversationId);
    await fetchMessages(conversationId);
    setOpen(false);
    scrollToMessage(messageId);
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
            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {allNotifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có thông báo nào.
                </p>
              ) : (
                allNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/70 p-3"
                  >
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
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium">{notification.title}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatMessageTime(new Date(notification.createdAt))}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 rounded-full"
                      onClick={() => removeNotification(notification.id)}
                    >
                      <X className="size-4" />
                      <span className="sr-only">Xóa thông báo</span>
                    </Button>
                  </div>
                ))
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
