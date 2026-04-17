import { toast } from "sonner";

import type { Conversation, Message } from "@/types/chat";
import { getParticipantId } from "./chatParticipants";
import { isGroupNotificationEnabled } from "./groupNotificationSettings";
import { isDirectNotificationEnabled } from "./directChatPreferences";

type NotificationSetting = {
  enableAll: boolean;
  messageNotification: boolean;
  messageSound: boolean;
  friendRequestNotification: boolean;
  systemNotification: boolean;
};

const STORAGE_KEY = "chat_notification_settings";

const defaultSettings: NotificationSetting = {
  enableAll: true,
  messageNotification: true,
  messageSound: true,
  friendRequestNotification: true,
  systemNotification: true,
};

export const getNotificationSettings = (): NotificationSetting => {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;

    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
};

export const requestDesktopNotificationPermission = async () => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission !== "default") {
    return;
  }

  try {
    await Notification.requestPermission();
  } catch (error) {
    console.error("Không thể xin quyền thông báo:", error);
  }
};

const isWindowInBackground = () => {
  if (typeof document === "undefined") {
    return false;
  }

  return document.visibilityState !== "visible" || !document.hasFocus();
};

const getMessagePreview = (message: Message) => {
  if (message.content?.trim()) {
    return message.content.trim();
  }

  if (message.imgUrl) {
    return "Đã gửi một hình ảnh";
  }

  return "Mở đoạn chat để xem ngay";
};

const getSenderName = (
  conversation: Conversation | undefined,
  message: Message,
  currentUserId?: string,
) => {
  if (!conversation) {
    return "Ai do";
  }

  const participants = conversation.participants ?? [];

  if (conversation.type === "group") {
    const sender =
      participants.find(
        (participant) => getParticipantId(participant) === message.senderId,
      ) ?? null;

    return sender?.displayName ?? "Thành viên";
  }

  const otherParticipant =
    participants.find(
      (participant) => getParticipantId(participant) !== currentUserId,
    ) ?? null;

  return otherParticipant?.displayName ?? "Người dùng";
};

const getNotificationTitle = (
  conversation: Conversation | undefined,
  senderName: string,
) => {
  if (!conversation) {
    return senderName;
  }

  if (conversation.type === "group") {
    return `${senderName} trong ${conversation.group?.name ?? "nhóm chat"}`;
  }

  return senderName;
};

type NotifyIncomingMessageArgs = {
  conversation?: Conversation;
  message: Message;
  currentUserId?: string;
  onOpenConversation?: () => void;
};

export const notifyIncomingMessage = ({
  conversation,
  message,
  currentUserId,
  onOpenConversation,
}: NotifyIncomingMessageArgs) => {
  if (conversation?.type === "group" && !isGroupNotificationEnabled(conversation._id)) {
    return;
  }

  if (conversation?.type === "direct" && !isDirectNotificationEnabled(conversation._id)) {
    return;
  }

  const settings = getNotificationSettings();
  if (!settings.enableAll || !settings.messageNotification) {
    return;
  }

  const senderName = getSenderName(conversation, message, currentUserId);
  const body = `${senderName} vừa nhắn tin cho bạn, kiểm tra ngay nhé`;
  const description = getMessagePreview(message);

  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    isWindowInBackground() &&
    Notification.permission === "granted"
  ) {
    const notification = new Notification(getNotificationTitle(conversation, senderName), {
      body,
      tag: `message-${message.conversationId}`,
    });

    notification.onclick = () => {
      window.focus();
      onOpenConversation?.();
      notification.close();
    };

    return;
  }

  toast.message(body, {
    id: `message-toast-${message._id}`,
    description,
    action: onOpenConversation
      ? {
          label: "Mở",
          onClick: onOpenConversation,
        }
      : undefined,
  });
};
