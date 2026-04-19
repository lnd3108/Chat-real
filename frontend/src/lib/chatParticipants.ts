import type { LastMessage, Participant, SeenUser } from "@/types/chat";

export const DELETED_USER_LABEL = "Người dùng đã xóa";

export const getParticipantId = (participant?: Participant | null): string => {
  if (!participant) return "";

  return typeof participant.userId === "string"
    ? participant.userId
    : participant.userId?._id ?? participant._id ?? "";
};

export const getParticipantProfile = (participant?: Participant | null) => {
  if (!participant) return null;

  return participant.userId && typeof participant.userId === "object"
    ? participant.userId
    : participant;
};

export const getLastMessageSenderId = (
  lastMessage?: LastMessage | null,
): string => {
  if (!lastMessage) return "";
  if (lastMessage.sender?._id) return lastMessage.sender._id;

  const rawSenderId = lastMessage.senderId;
  if (typeof rawSenderId === "string") return rawSenderId;
  if (rawSenderId && typeof rawSenderId === "object") {
    return rawSenderId._id ?? "";
  }

  return "";
};

export const getDeletedAwareSenderName = (options: {
  senderDeleted?: boolean;
  senderDisplayName?: string | null;
  senderId?: string | { _id?: string } | null;
  fallback?: string;
}) => {
  if (options.senderDeleted || !options.senderId) {
    return options.senderDisplayName ?? DELETED_USER_LABEL;
  }

  return options.fallback ?? "";
};

export const normalizeSeenUser = (
  seenUser: SeenUser | string,
): SeenUser =>
  typeof seenUser === "string" ? { _id: seenUser } : seenUser;

export const hasHydratedParticipants = (participants?: Participant[]) =>
  Array.isArray(participants) &&
  participants.length > 0 &&
  participants.some(
    (participant) =>
      typeof participant.userId === "object" ||
      !!participant.displayName ||
      !!participant.avatarUrl,
  );
