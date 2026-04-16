import { toast } from "sonner";

import type { Conversation, Message } from "@/types/chat";

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

const getParticipantId = (participant: any) =>
  typeof participant?.userId === "string"
    ? participant.userId
    : participant?.userId?._id ?? participant?._id;

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
    console.error("Failed to request notification permission:", error);
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
    return "Da gui mot hinh anh";
  }

  return "Mo doan chat de xem ngay";
};

const getSenderName = (
  conversation: Conversation | undefined,
  message: Message,
  currentUserId?: string,
) => {
  if (!conversation) {
    return "Ai do";
  }

  if (conversation.type === "group") {
    const sender =
      conversation.participants.find(
        (participant) => getParticipantId(participant) === message.senderId,
      ) ?? null;

    return sender?.displayName ?? "Thanh vien";
  }

  const otherParticipant =
    conversation.participants.find(
      (participant) => getParticipantId(participant) !== currentUserId,
    ) ?? null;

  return otherParticipant?.displayName ?? "Nguoi dung";
};

const getNotificationTitle = (
  conversation: Conversation | undefined,
  senderName: string,
) => {
  if (!conversation) {
    return senderName;
  }

  if (conversation.type === "group") {
    return `${senderName} trong ${conversation.group?.name ?? "nhom chat"}`;
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
  const settings = getNotificationSettings();
  if (!settings.enableAll || !settings.messageNotification) {
    return;
  }

  const senderName = getSenderName(conversation, message, currentUserId);
  const body = `${senderName} vua nhan tin cho ban, check ngay nhe`;
  const description = getMessagePreview(message);

  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    isWindowInBackground() &&
    Notification.permission === "granted"
  ) {
    const notification = new Notification(
      getNotificationTitle(conversation, senderName),
      {
        body,
        tag: `message-${message.conversationId}`,
      },
    );

    notification.onclick = () => {
      window.focus();
      onOpenConversation?.();
      notification.close();
    };

    return;
  }

  toast.message(body, {
    description,
    action: onOpenConversation
      ? {
          label: "Mo",
          onClick: onOpenConversation,
        }
      : undefined,
  });
};
