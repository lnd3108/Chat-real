import { emitToUser } from "./socket-gateway.js";
import { emitToRoom } from "./socket-gateway.js";

export const emitFriendRequestReceived = ({ toUserId, request }) => {
  emitToUser(toUserId, "friend:request:received", { request });
};

export const emitFriendRequestSent = ({ fromUserId, request }) => {
  emitToUser(fromUserId, "friend:request:sent", { request });
};

export const emitFriendRequestAccepted = ({ userIds, payload }) => {
  userIds.forEach((userId) => emitToUser(userId, "friend:request:accepted", payload));
};

export const emitFriendRequestRemoved = ({ userIds, payload }) => {
  userIds.forEach((userId) => emitToUser(userId, "friend:request:removed", payload));
};

export const emitFriendRemoved = ({ userIds, payload }) => {
  userIds.forEach((userId) => emitToUser(userId, "friend:removed", payload));
};

export const emitConversationDeletedForUsers = ({ userIds, conversationId }) => {
  userIds.forEach((userId) => emitToUser(userId, "conversation:deleted", { conversationId }));
  emitToRoom(conversationId, "conversation:deleted", { conversationId });
};
