import { useMemo } from "react";
import { Bell, Flag, LifeBuoy, Trash2, Users, Wrench } from "lucide-react";
import { useNavigate } from "react-router";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { useAdminNotificationStore } from "@/features/admin/stores/useAdminNotificationStore";
import { formatMessageTime } from "@/shared/lib/utils";

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const getIcon = (type: string) => {
  switch (type) {
    case "user":
      return <Users className="size-4 text-sky-600" />;
    case "report":
      return <Flag className="size-4 text-amber-600" />;
    case "support":
      return <LifeBuoy className="size-4 text-emerald-600" />;
    case "system":
      return <Wrench className="size-4 text-rose-600" />;
    default:
      return <Bell className="size-4 text-primary" />;
  }
};

const AdminNotificationCenterDialog = ({ open, setOpen }: Props) => {
  const navigate = useNavigate();
  const { items, markAllAsRead, markAsRead, clearAll, removeNotification } =
    useAdminNotificationStore();

  const notifications = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [items],
  );

  const handleOpen = (id: string, link?: string | null) => {
    markAsRead(id);
    if (link) {
      navigate(link);
      setOpen(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          markAllAsRead();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Thông báo admin</DialogTitle>
        </DialogHeader>

        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={clearAll}>
            <Trash2 className="mr-2 size-4" />
            Xóa tất cả
          </Button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa có thông báo nào. Hãy kiểm tra lại sau nhé!
            </p>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 rounded-xl border p-3 ${
                  item.isRead ? "bg-card/60" : "bg-primary/5"
                }`}
              >
                <div className="rounded-full bg-muted p-2">
                  {getIcon(item.type)}
                </div>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => handleOpen(item.id, item.link)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <span className="text-xs text-muted-foreground">
                      {formatMessageTime(new Date(item.createdAt))}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.message}
                  </p>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => removeNotification(item.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminNotificationCenterDialog;
