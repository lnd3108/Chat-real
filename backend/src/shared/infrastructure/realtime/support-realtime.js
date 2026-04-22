import {
  ADMIN_SOCKET_EVENTS,
  USER_SOCKET_EVENTS,
} from "../../domain/constants/socket-events.js";
import { emitToAdmins } from "./admin-room.js";
import { emitToUser } from "./socket-gateway.js";

export const emitSupportConversationRealtimeEvent = ({
  type,
  conversation,
  message = null,
  actor = null,
  buildAdminActor,
}) => {
  const payload = {
    conversationId: conversation?._id,
    conversation,
    message,
    actor: buildAdminActor(actor),
    createdAt: new Date().toISOString(),
  };

  emitToAdmins(ADMIN_SOCKET_EVENTS.SUPPORT_NEW_MESSAGE, payload);

  const targetUserId =
    conversation?.supportCreatedByUser?._id ??
    conversation?.supportCreatedByUserId ??
    null;

  if (type === "reply" && targetUserId) {
    emitToUser(targetUserId, USER_SOCKET_EVENTS.SUPPORT_REPLY_NEW, payload);
  }

  return payload;
};
