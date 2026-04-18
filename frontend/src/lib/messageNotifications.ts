import { toast } from "sonner";

import type { Conversation, Message } from "@/types/chat";
import type { AppNotification } from "@/types/store";
import { getParticipantId } from "./chatParticipants";
import { isDirectNotificationEnabled } from "./directChatPreferences";
import { isGroupNotificationEnabled } from "./groupNotificationSettings";

export type NotificationSetting = {
  enableAll: boolean;
  soundEnabled: boolean;
  messageNotification: boolean;
  messageSound: boolean;
  typingSound: boolean;
  clickSound: boolean;
  friendRequestNotification: boolean;
  systemNotification: boolean;
};

const STORAGE_KEY = "chat_notification_settings";
const SETTINGS_EVENT = "chat-notification-settings-changed";

export const defaultNotificationSettings: NotificationSetting = {
  enableAll: true,
  soundEnabled: true,
  messageNotification: true,
  messageSound: true,
  typingSound: true,
  clickSound: true,
  friendRequestNotification: true,
  systemNotification: true,
};

export const getNotificationSettings = (): NotificationSetting => {
  if (typeof window === "undefined") {
    return defaultNotificationSettings;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultNotificationSettings;

    return { ...defaultNotificationSettings, ...JSON.parse(raw) };
  } catch {
    return defaultNotificationSettings;
  }
};

export const saveNotificationSettings = (settings: NotificationSetting) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: settings }));
};

export const updateNotificationSettings = (
  updater:
    | Partial<NotificationSetting>
    | ((current: NotificationSetting) => NotificationSetting),
) => {
  const current = getNotificationSettings();
  const next =
    typeof updater === "function"
      ? updater(current)
      : { ...current, ...updater };

  saveNotificationSettings(next);
  return next;
};

export const subscribeNotificationSettings = (
  listener: (settings: NotificationSetting) => void,
) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleCustomEvent = (event: Event) => {
    const customEvent = event as CustomEvent<NotificationSetting>;
    listener(customEvent.detail ?? getNotificationSettings());
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      listener(getNotificationSettings());
    }
  };

  window.addEventListener(SETTINGS_EVENT, handleCustomEvent as EventListener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(SETTINGS_EVENT, handleCustomEvent as EventListener);
    window.removeEventListener("storage", handleStorage);
  };
};

export const areAllSoundsEnabled = (settings = getNotificationSettings()) =>
  settings.soundEnabled;

export const setAllSoundsEnabled = (enabled: boolean) =>
  updateNotificationSettings((current) => ({
    ...current,
    soundEnabled: enabled,
    messageSound: enabled,
    typingSound: enabled,
    clickSound: enabled,
  }));

export const isNotificationEnabledForConversation = (
  conversation?: Conversation,
  conversationId?: string,
) => {
  const targetConversationId = conversation?._id ?? conversationId;

  if (conversation?.type === "group") {
    return targetConversationId ? isGroupNotificationEnabled(targetConversationId) : true;
  }

  if (conversation?.type === "direct") {
    return targetConversationId ? isDirectNotificationEnabled(targetConversationId) : true;
  }

  return true;
};

export const shouldStoreNotification = (
  type: AppNotification["type"],
  options?: {
    conversation?: Conversation;
    conversationId?: string;
    settings?: NotificationSetting;
  },
) => {
  const settings = options?.settings ?? getNotificationSettings();

  if (!settings.enableAll) {
    return false;
  }

  switch (type) {
    case "new_message":
      return (
        settings.messageNotification &&
        isNotificationEnabledForConversation(
          options?.conversation,
          options?.conversationId,
        )
      );
    case "friend_request":
      return settings.friendRequestNotification;
    case "added_to_group":
    case "conversation_removed":
    case "conversation_deleted":
      return settings.systemNotification;
    default:
      return true;
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
    return "Ai đó";
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
  const settings = getNotificationSettings();
  if (
    !shouldStoreNotification("new_message", {
      conversation,
      conversationId: message.conversationId,
      settings,
    })
  ) {
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
