import { useRef, useState, type ChangeEvent } from "react";
import { Camera, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { chatServices } from "@/services/chatServices";
import { useChatStore } from "@/stores/useChatStore";
import type { Conversation } from "@/types/chat";
import GroupChatAvatar from "./GroupChatAvatar";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

interface GroupSettingsDialogProps {
  chat: Conversation;
}

const GroupSettingsDialog = ({ chat }: GroupSettingsDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

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

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Settings className="size-4" />
          <span className="sr-only">Cài đặt nhóm</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cài đặt nhóm</DialogTitle>
          <DialogDescription>
            Mọi thành viên đều có thể thay đổi ảnh đại diện nhóm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-muted/20 p-4">
            <GroupChatAvatar
              participants={chat.participants}
              type="sidebar"
              avatarUrl={chat.group?.avatarUrl}
              groupName={chat.group?.name}
              isUploading={avatarUploading}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{chat.group?.name}</p>
              <p className="text-sm text-muted-foreground">
                {chat.participants.length} thành viên
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-border/70 p-4">
            <p className="text-sm font-medium">Ảnh đại diện nhóm</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Khi thay ảnh mới, ảnh cũ trên Cloudinary sẽ được xóa tự động.
            </p>

            <Button
              type="button"
              onClick={handleOpenFilePicker}
              disabled={avatarUploading}
              className="mt-4 w-full"
            >
              {avatarUploading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Đang tải ảnh lên...
                </>
              ) : (
                <>
                  <Camera className="mr-2 size-4" />
                  Thay ảnh đại diện nhóm
                </>
              )}
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleGroupAvatarChange}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupSettingsDialog;
