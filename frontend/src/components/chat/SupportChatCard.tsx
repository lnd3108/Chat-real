import { LifeBuoy, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Conversation } from "@/types/chat";
import { useChatStore } from "@/stores/useChatStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { chatServices } from "@/services/chatServices";

import ChatCard from "./ChatCard";
import UnreadCountBadge from "./UnreadCountBadge";

const supportStatusLabelMap: Record<string, string> = {
  open: "Mở",
  in_progress: "Đang xử lý",
  resolved: "Đã giải quyết",
  closed: "Đã đóng",
};

const SupportChatCard = ({ convo }: { convo: Conversation }) => {
  const { user } = useAuthStore();
  const { activeConversationId, fetchMessages, messages, setActiveConversation, removeConversationLocal } =
    useChatStore();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!user) {
    return null;
  }

  const unreadCount = convo.unreadCounts?.[user._id] ?? 0;
  const statusLabel = supportStatusLabelMap[convo.supportStatus ?? "open"] ?? "Mở";
  const lastMessagePreview = convo.lastMessage?.content?.trim() || "Chưa có tin nhắn hỗ trợ";

  const handleSelectConversation = async (id: string) => {
    try {
      setActiveConversation(id);
      if (!messages[id]) {
        await fetchMessages(id);
      }
    } catch (error) {
      console.error("Không thể mở cuộc trò chuyện hỗ trợ:", error);
      toast.error("Không thể mở cuộc trò chuyện hỗ trợ lúc này.");
    }
  };

  const handleDeleteConversation = async () => {
    try {
      setIsDeleting(true);
      await chatServices.deleteSupportConversation(convo._id);
      removeConversationLocal(convo._id);
      toast.success("Đã xóa cuộc trò chuyện hỗ trợ");
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Lỗi xóa cuộc trò chuyện hỗ trợ:", error);
      toast.error("Không thể xóa cuộc trò chuyện hỗ trợ lúc này.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <ChatCard
        convoId={convo._id}
        name="Liên hệ hỗ trợ"
        timestamp={
          convo.lastMessage?.createdAt ? new Date(convo.lastMessage.createdAt) : undefined
        }
        isActive={activeConversationId === convo._id}
        onSelect={handleSelectConversation}
        unreadCount={unreadCount}
        leftSection={
          <>
            <div className="relative flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700">
              <LifeBuoy className="size-5" />
            </div>
            {unreadCount > 0 && <UnreadCountBadge unreadCount={unreadCount} />}
          </>
        }
        subtitle={
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-emerald-700">{statusLabel}</p>
            <p
              className={`truncate text-sm ${
                unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground"
              }`}
            >
              {lastMessagePreview}
            </p>
          </div>
        }
        actions={
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(event) => {
                event.stopPropagation();
                void handleSelectConversation(convo._id);
              }}
            >
              <LifeBuoy className="size-4 text-muted-foreground" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={(event) => {
                event.stopPropagation();
                setShowDeleteDialog(true);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        }
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa cuộc trò chuyện hỗ trợ?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Cuộc trò chuyện sẽ bị xóa khỏi danh sách của bạn, nhưng lịch sử vẫn được lưu
              cho hỗ trợ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <Button
              onClick={handleDeleteConversation}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting ? "Đang xóa..." : "Xóa"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SupportChatCard;
