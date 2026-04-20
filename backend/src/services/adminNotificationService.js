import { ADMIN_SOCKET_EVENTS } from "../constants/socketEvents.js";
import { emitToAdmins } from "../socket/adminSocket.js";

export const buildAdminActor = (user) => {
  if (!user) {
    return null;
  }

  return {
    _id: user._id,
    displayName: user.displayName,
    userName: user.userName,
    email: user.email ?? null,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role ?? "user",
    status: user.status ?? "active",
    createdAt: user.createdAt ?? null,
  };
};

export const emitAdminNotification = ({
  type,
  title,
  message,
  link = null,
  entityId = null,
  actor = null,
  metadata = {},
  severity = "info",
  createdAt = new Date().toISOString(),
}) => {
  emitToAdmins(ADMIN_SOCKET_EVENTS.SYSTEM_NOTIFICATION, {
    id: `${type}-${entityId ?? Date.now()}`,
    type,
    title,
    message,
    link,
    entityId,
    actor,
    metadata,
    severity,
    createdAt,
  });
};
