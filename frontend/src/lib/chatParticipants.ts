import type { LastMessage, Participant, SeenUser } from "@/types/chat";

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
): string => lastMessage?.sender?._id ?? lastMessage?.senderId ?? "";

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
