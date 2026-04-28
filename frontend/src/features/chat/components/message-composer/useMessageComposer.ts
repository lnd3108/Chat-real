import axios from "axios";
import { getErrorMeta, logger } from "@/shared/lib/logger";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import {
  getParticipantId,
  getParticipantProfile,
} from "@/features/chat/lib/chatParticipants";
import { userService } from "@/features/settings/services/userService";
import { playKeystrokeSound, shouldPlayKeystrokeSound } from "@/features/settings/lib/sound";
import type { Conversation } from "@/shared/types/chat";

export const useMessageComposer = (selectedConvo: Conversation) => {
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

  const otherParticipant =
    selectedConvo.type === "direct" && user
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
    const targetLabel =
      otherUser?.userName ?? otherUser?.displayName ?? "người dùng này";

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
    if (!user) return;
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

  return {
    user,
    value,
    setValue,
    image,
    previewUrl,
    sending,
    uploadProgress,
    pendingAction,
    statusText,
    replyingTo,
    editingMessage,
    setReplyingTo,
    setEditingMessage,
    isUnblocking,
    otherUser,
    isBlockedByMe,
    isComposerBlocked,
    blockBannerText,
    handleUnblock,
    handleSelectImage,
    handleKeyPress,
    handleBeforeInput,
    sendMessage,
    resetImage,
    setIsComposing: (value: boolean) => {
      isComposingRef.current = value;
    },
  };
};
