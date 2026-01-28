import { Card } from "@/components/ui/card";
import { formatOnlineTime, cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";
import type React from "react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useRef } from "react";
import { toast } from "sonner";

interface ChatCardProps {
  convoId: string;
  name: string;
  timestamp?: Date;
  isActive: boolean;
  onSelect: (id: string) => void;
  unreadCount?: number;
  leftSection: React.ReactNode;
  subtitle: React.ReactNode;
  canDelete?: boolean;

  //  menu options
  onDeleteConversation?: (id: string) => void | Promise<void>;
  menuItems?: React.ReactNode; // optional: thêm items khác sau này
}

const ChatCard = ({
  convoId,
  name,
  timestamp,
  isActive,
  onSelect,
  unreadCount,
  leftSection,
  canDelete = true,
  subtitle,
  onDeleteConversation,
  menuItems,
}: ChatCardProps) => {
  const hasMenu = !!onDeleteConversation || !!menuItems;
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <Card
      key={convoId}
      className={cn(
        // thêm "group" để group-hover hoạt động
        "group border-none p-3 cursor-pointer transition-smooth glass hover:bg-muted/30",
        isActive &&
          "ring-2 ring-primary/50 bg-gradient-to-tr from-primary-glow/10 to-primary-foreground ",
      )}
      onClick={() => onSelect(convoId)}
    >
      <div className="flex items-center gap-3">
        <div className="relative">{leftSection}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3
              className={cn(
                "font-semibold text-sm truncate",
                unreadCount && unreadCount > 0 && "text-foreground",
              )}
            >
              {name}
            </h3>

            <span className="text-xs text-muted-foreground">
              {timestamp ? formatOnlineTime(timestamp) : ""}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 text-sm">{subtitle}</div>

            {/* Menu */}
            {hasMenu ? (
              <AlertDialog>
                {/* ✅ Trigger ẩn để tránh ref warning */}
                <AlertDialogTrigger asChild>
                  <button
                    ref={deleteTriggerRef}
                    type="button"
                    className="hidden"
                    onClick={(e) => e.stopPropagation()}
                  />
                </AlertDialogTrigger>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="p-2 -mr-2 rounded-md hover:bg-muted/40 transition-smooth opacity-0 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="size-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {menuItems}

                    {menuItems && onDeleteConversation && (
                      <DropdownMenuSeparator />
                    )}

                    {onDeleteConversation && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          if (!canDelete) {
                            toast.error(
                              "Bạn không xóa được cuộc trò chuyện này",
                            );
                            return;
                          }

                          deleteTriggerRef.current?.click(); // ✅ owner mới mở confirm
                        }}
                      >
                        Xóa cuộc trò chuyện
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {onDeleteConversation && (
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Xóa cuộc trò chuyện?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Hành động này sẽ xóa cuộc trò chuyện khỏi danh sách của
                        bạn.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground"
                        onClick={() => onDeleteConversation(convoId)}
                      >
                        Xóa
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                )}
              </AlertDialog>
            ) : (
              <MoreHorizontal className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-smooth" />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ChatCard;
