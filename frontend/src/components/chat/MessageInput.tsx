import { useAuthStore } from "@/stores/useAuthStore";
import type { Conversation } from "@/types/chat";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { Input } from "../ui/input";
import EmojiPicker from "./EmojiPicker";
import { useChatStore } from "@/stores/useChatStore";
import { toast } from "sonner";

const MessageInput = ({ selectedConvo }: { selectedConvo: Conversation }) => {
  const { user } = useAuthStore();
  const {
    editMessage,
    editingMessage,
    replyingTo,
    sendDirectMessage,
    sendDirectMessageWithImage,
    sendGroupMessage,
    sendGroupMessageWithImage,
    setEditingMessage,
    setReplyingTo,
  } = useChatStore();
  const [value, setValue] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!user) return;

  useEffect(() => {
    if (!editingMessage) return;
    setValue(editingMessage.content ?? "");
    setImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [editingMessage]);

  const resetImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setImage(null);
    setPreviewUrl(null);
  };

  const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Chỉ chấp nhận file hình ảnh.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Hình ảnh phải nhỏ hơn 5MB.");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = "";
  };

  const sendMessage = async () => {
    if (!value.trim() && !image) return;
    const currValue = value;

    try {
      setSending(true);

      if (editingMessage?._id) {
        await editMessage(editingMessage._id, currValue);
        setValue("");
        return;
      }

      if (selectedConvo.type === "direct") {
        const participants = selectedConvo.participants;
        const otherUser = participants.find((p) => p._id !== user._id);

        if (!otherUser?._id) {
          toast.error("Không tìm thấy người nhận.");
          return;
        }

        if (image) {
          await sendDirectMessageWithImage(otherUser._id, image, currValue);
        } else {
          await sendDirectMessage(otherUser._id, currValue);
        }
      } else if (image) {
        await sendGroupMessageWithImage(selectedConvo._id, image, currValue);
      } else {
        await sendGroupMessage(selectedConvo._id, currValue);
      }

      setValue("");
      resetImage();
    } catch (error) {
      console.error(error);
      toast.error("Gửi tin nhắn thất bại. Vui lòng thử lại.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="space-y-2 p-3 bg-background">
      {(replyingTo || editingMessage) && (
        <div className="flex items-start justify-between rounded-xl border border-border/60 bg-card px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary">
              {editingMessage ? "Đang chỉnh sửa tin nhắn" : "Đang trả lời"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {editingMessage
                ? editingMessage.content || "Tin nhắn hình ảnh"
                : replyingTo?.content || (replyingTo?.imgUrl ? "Hình ảnh" : "Tin nhắn")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => {
              setReplyingTo(null);
              setEditingMessage(null);
              setValue("");
            }}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {previewUrl && (
        <div className="relative inline-flex overflow-hidden rounded-xl border border-border/60 bg-card p-2">
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-28 rounded-lg object-cover transition-opacity duration-200"
          />
          {sending && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/65 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="size-7 animate-spin text-primary" />
                <span className="text-xs font-medium text-foreground/80">
                  Đang tải ảnh...
                </span>
              </div>
            </div>
          )}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute -right-2 -top-2 size-6 rounded-full"
            onClick={resetImage}
            disabled={sending}
          >
            <X className="size-3" />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 min-h-[56]">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hover:bg-primary/10 transition-smooth"
          asChild
        >
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleSelectImage}
              disabled={sending}
            />
            <ImagePlus className="size-4" />
          </label>
        </Button>

        <div className="flex-1 relative">
          <Input
            onKeyDown={handleKeyPress}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Soạn tin nhắn..."
            className="pr-20 h-9 bg-white border-border/50 focus:border-primary/50 transition-smooth resize-none"
            disabled={sending}
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="size-8 hover:bg-background/10 transition-smooth"
            >
              <div>
                <EmojiPicker
                  onChange={(emoji: string) => setValue(`${value}${emoji}`)}
                />
              </div>
            </Button>
          </div>
        </div>

        <Button
          onClick={() => void sendMessage()}
          className="bg-gradient-chat hover:shadow-glow transition-smooth hover:scale-105"
          disabled={sending || (!value.trim() && !image)}
        >
          <Send className="size-4 text-white" />
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;
