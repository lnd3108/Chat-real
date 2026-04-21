import axios from "axios";
import { getErrorMeta, logger } from "@/lib/logger";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { getParticipantId, getParticipantProfile } from "@/lib/chatParticipants";
import { userService } from "@/services/userService";
import {
  playClickSound,
  playKeystrokeSound,
  shouldPlayKeystrokeSound,
} from "@/lib/sound";
import type { Conversation } from "@/types/chat";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import EmojiPicker from "./EmojiPicker";

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
    sendSupportMessage,
    setEditingMessage,
    setReplyingTo,
  } = useChatStore();
  const [value, setValue] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingAction, setPendingAction] = useState<
    "message" | "image" | "edit" | null
  >(null);
  const [isUnblocking, setIsUnblocking] = useState(false);
  const uploadProgressValueRef = useRef(0);
  const uploadProgressTargetRef = useRef(0);
  const uploadProgressTimerRef = useRef<number | null>(null);
  const isComposingRef = useRef(false);

  useEffect(() => {
    if (!editingMessage) return;
    setValue(editingMessage.content ?? "");
    setImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [editingMessage, previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    uploadProgressValueRef.current = uploadProgress;
  }, [uploadProgress]);

  if (!user) return null;

  const otherParticipant =
    selectedConvo.type === "direct"
      ? selectedConvo.participants.find(
          (participant) => getParticipantId(participant) !== user._id,
        )
      : null;
  const otherUser = getParticipantProfile(otherParticipant);
  const isBlockedByMe = selectedConvo.blockInfo?.blockedByMe ?? false;
  const isBlockedByOther = selectedConvo.blockInfo?.blockedByOther ?? false;
  const isComposerBlocked =
    selectedConvo.type === "direct" && (isBlockedByMe || isBlockedByOther);
  const blockBannerText = isBlockedByMe
    ? "Bạn đã chặn người dùng này. Bạn không thể nhắn tin cho họ trong cuộc trò chuyện này."
    : isBlockedByOther
      ? "Bạn hiện không thể nhắn tin cho tài khoản này."
      : null;

  const runUploadProgressAnimation = () => {
    if (uploadProgressTimerRef.current) return;

    const tick = () => {
      const current = uploadProgressValueRef.current;
      const target = uploadProgressTargetRef.current;

      if (current >= target) {
        uploadProgressTimerRef.current = null;
        return;
      }

      const gap = target - current;
      const step = gap > 20 ? 4 : gap > 10 ? 3 : gap > 4 ? 2 : 1;
      const next = Math.min(current + step, target);

      uploadProgressValueRef.current = next;
      setUploadProgress(next);

      if (next < target) {
        uploadProgressTimerRef.current = window.setTimeout(tick, 40);
      } else {
        uploadProgressTimerRef.current = null;
      }
    };

    uploadProgressTimerRef.current = window.setTimeout(tick, 40);
  };

  const setUploadProgressTarget = (progress: number) => {
    uploadProgressTargetRef.current = Math.max(0, Math.min(progress, 100));
    runUploadProgressAnimation();
  };

  const handleUnblock = async () => {
    const targetUserId = getParticipantId(otherParticipant);
    const targetLabel = otherUser?.userName ?? otherUser?.displayName ?? "người dùng này";

    if (!targetUserId) {
      toast.error("Không tìm thấy người dùng để bỏ chặn.");
      return;
    }

    try {
      setIsUnblocking(true);
      await userService.unblockUser(targetUserId);
      toast.success(`Đã bỏ chặn @${targetLabel}`);
    } catch (error) {
      logger.error("Loi bo chan nguoi dung tu khung chat", getErrorMeta(error));
      toast.error("Không thể bỏ chặn người dùng lúc này.");
    } finally {
      setIsUnblocking(false);
    }
  };

  const finishUploadProgress = async () => {
    setUploadProgressTarget(100);

    await new Promise<void>((resolve) => {
      const waitForComplete = () => {
        if (uploadProgressTargetRef.current !== 100) {
          resolve();
          return;
        }

        if (uploadProgressValueRef.current >= 100) {
          resolve();
          return;
        }

        window.setTimeout(waitForComplete, 30);
      };

      waitForComplete();
    });

    await new Promise((resolve) => window.setTimeout(resolve, 120));
  };

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
    if (sending) return;
    if (!value.trim() && !image) return;
    const currValue = value;
    const hasImage = Boolean(image);
    const nextAction = editingMessage ? "edit" : hasImage ? "image" : "message";

    try {
      setSending(true);
      setPendingAction(nextAction);
      uploadProgressValueRef.current = hasImage ? 0 : 100;
      uploadProgressTargetRef.current = hasImage ? 0 : 100;
      setUploadProgress(hasImage ? 0 : 100);

      if (editingMessage?._id) {
        await editMessage(editingMessage._id, currValue);
        setValue("");
        return;
      }

      if (selectedConvo.type === "support") {
        if (image) {
          toast.error("Phiên bản hiện tại chưa hỗ trợ gửi ảnh trong hỗ trợ.");
          return;
        }

        await sendSupportMessage(selectedConvo._id, currValue);
      } else if (selectedConvo.type === "direct") {
        const participants = selectedConvo.participants;
        const otherUser = participants.find((p) => p._id !== user._id);

        if (!otherUser?._id) {
          toast.error("Không tìm thấy người nhận.");
          return;
        }

        if (image) {
          await sendDirectMessageWithImage(otherUser._id, image, currValue, {
            onUploadProgress: (progress) =>
              setUploadProgressTarget(Math.min(progress, 95)),
          });
          await finishUploadProgress();
        } else {
          await sendDirectMessage(otherUser._id, currValue);
        }
      } else if (image) {
        await sendGroupMessageWithImage(selectedConvo._id, image, currValue, {
          onUploadProgress: (progress) =>
            setUploadProgressTarget(Math.min(progress, 95)),
        });
        await finishUploadProgress();
      } else {
        await sendGroupMessage(selectedConvo._id, currValue);
      }

      setValue("");
      resetImage();
    } catch (error) {
      logger.error("Loi gui tin nhan hoac tep dinh kem", getErrorMeta(error));
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : axios.isAxiosError(error) && error.code === "ECONNABORTED"
            ? "Tải ảnh lên quá lâu hoặc thất bại. Vui lòng thử lại."
            : "Gửi tin nhắn thất bại. Vui lòng thử lại.";
      toast.error(message);
    } finally {
      setSending(false);
      setPendingAction(null);
      uploadProgressTargetRef.current = 0;
      uploadProgressValueRef.current = 0;
      if (uploadProgressTimerRef.current) {
        window.clearTimeout(uploadProgressTimerRef.current);
        uploadProgressTimerRef.current = null;
      }
      setUploadProgress(0);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
      return;
    }

    if (shouldPlayKeystrokeSound(e, isComposingRef.current)) {
      playKeystrokeSound();
    }
  };

  const handleBeforeInput = (e: React.FormEvent<HTMLInputElement>) => {
    const nativeEvent = e.nativeEvent as InputEvent;

    if (
      isComposingRef.current ||
      nativeEvent.isComposing ||
      !nativeEvent.inputType?.startsWith("insert") ||
      !nativeEvent.data
    ) {
      return;
    }

    playKeystrokeSound();
  };

  const statusText =
    pendingAction === "edit"
      ? "Đang lưu chỉnh sửa..."
      : pendingAction === "image"
        ? uploadProgress > 0
          ? `Đang tải ảnh ${uploadProgress}%`
          : "Đang chuẩn bị tải ảnh..."
        : pendingAction === "message"
          ? "Đang gửi tin nhắn..."
          : null;

  return (
    <div className="space-y-2 bg-background p-3">
      {statusText && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
          <Loader2 className="size-4 animate-spin" />
          <span className="font-medium">{statusText}</span>
        </div>
      )}

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
              playClickSound();
              setReplyingTo(null);
              setEditingMessage(null);
              setValue("");
            }}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {isComposerBlocked && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-3 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-destructive">
                {blockBannerText}
              </p>
              {isBlockedByMe && otherUser?.displayName && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Cuộc trò chuyện với {otherUser.displayName} vẫn được giữ lại, nhưng gửi
                  tin nhắn mới đang bị tắt cho đến khi bạn bỏ chặn.
                </p>
              )}
            </div>

            {isBlockedByMe && (
              <Button
                type="button"
                variant="outline"
                className="border-destructive/30 bg-background/80 text-destructive hover:bg-destructive/10 hover:text-destructive sm:shrink-0"
                onClick={() => {
                  playClickSound();
                  void handleUnblock();
                }}
                disabled={isUnblocking}
              >
                {isUnblocking ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Đang bỏ chặn</span>
                  </>
                ) : (
                  <span>Bỏ chặn</span>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="relative inline-flex overflow-hidden rounded-xl border border-border/60 bg-card p-2">
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-28 rounded-lg object-cover transition-opacity duration-200"
          />
          {pendingAction === "image" && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/65 backdrop-blur-[1px]">
              <div className="w-full max-w-[180px] px-4">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="size-7 animate-spin text-primary" />
                  <span className="text-xs font-medium text-foreground/80">
                    {uploadProgress > 0
                      ? `Đang tải ảnh ${uploadProgress}%`
                      : "Đang tải ảnh..."}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/70">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200"
                    style={{ width: `${Math.max(uploadProgress, 8)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute -right-2 -top-2 size-6 rounded-full"
            onClick={() => {
              playClickSound();
              resetImage();
            }}
            disabled={sending}
          >
            <X className="size-3" />
          </Button>
        </div>
      )}

      <div className="flex min-h-[56] items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="transition-smooth hover:bg-primary/10"
          asChild
          disabled={sending || isComposerBlocked || selectedConvo.type === "support"}
        >
          <label
            className={
              sending ? "cursor-not-allowed pointer-events-none" : "cursor-pointer"
            }
            onClick={() => {
              if (!sending && !isComposerBlocked) {
                playClickSound();
              }
            }}
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleSelectImage}
              disabled={sending || isComposerBlocked || selectedConvo.type === "support"}
            />
            <ImagePlus className="size-4" />
          </label>
        </Button>

        <div className="relative flex-1">
          <Input
            onKeyDown={handleKeyPress}
            onBeforeInput={handleBeforeInput}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              selectedConvo.type === "support"
                ? "Nhập nội dung cần hỗ trợ..."
                : "Soạn tin nhắn..."
            }
            className="h-9 resize-none border-border/50 bg-white pr-20 transition-smooth focus:border-primary/50"
            disabled={sending || isComposerBlocked}
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="size-8 transition-smooth hover:bg-background/10"
              disabled={isComposerBlocked}
            >
              <div>
                <EmojiPicker
                  onChange={(emoji: string) => {
                    if (!isComposerBlocked) {
                      setValue(`${value}${emoji}`);
                    }
                  }}
                />
              </div>
            </Button>
          </div>
        </div>

        <Button
          onClick={() => {
            playClickSound();
            void sendMessage();
          }}
          className="min-w-24 bg-gradient-chat transition-smooth hover:scale-105 hover:shadow-glow"
          disabled={sending || isComposerBlocked || (!value.trim() && !image)}
          aria-label={statusText ?? "Gửi tin nhắn"}
        >
          {sending ? (
            <>
              <Loader2 className="size-4 animate-spin text-white" />
              <span className="text-white">
                {pendingAction === "edit"
                  ? "Đang lưu"
                  : pendingAction === "image"
                    ? "Đang tải"
                    : "Đang gửi"}
              </span>
            </>
          ) : (
            <>
              <Send className="size-4 text-white" />
              <span className="text-white">Gửi</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;
