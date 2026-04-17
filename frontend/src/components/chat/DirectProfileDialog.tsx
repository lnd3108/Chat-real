import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import UserAvatar from "./UserAvatar";

interface DirectProfileDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  displayName: string;
  userName?: string;
  avatarUrl?: string;
  bio?: string | null;
  statusLabel?: string;
}

const DirectProfileDialog = ({
  open,
  onOpenChange,
  trigger,
  displayName,
  userName,
  avatarUrl,
  bio,
  statusLabel,
}: DirectProfileDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}

      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-3">
          <DialogTitle>Thông tin cá nhân</DialogTitle>
          <DialogDescription>
            Chỉ hiển thị các thông tin công khai trong direct chat, không gồm email, địa chỉ
            hoặc số điện thoại.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="flex items-center gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <UserAvatar
              type="profile"
              name={displayName}
              avatarUrl={avatarUrl}
              className="size-20 text-2xl"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-semibold">{displayName}</p>
              <p className="truncate text-sm text-muted-foreground">
                @{userName || "chatrealtime"}
              </p>
              {statusLabel ? (
                <Badge variant="secondary" className="mt-3">
                  {statusLabel}
                </Badge>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 p-4">
            <p className="text-sm font-medium">Giới thiệu</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {bio?.trim() || "Người dùng này chưa cập nhật giới thiệu."}
            </p>
          </section>

          <section className="rounded-2xl border border-dashed border-border/70 p-4">
            <p className="text-sm font-medium">Thông tin hiển thị</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Hồ sơ trong direct chat chỉ dùng tên hiển thị, username, ảnh đại diện và trạng
              thái hoạt động để giữ an toàn thông tin riêng tư.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DirectProfileDialog;
