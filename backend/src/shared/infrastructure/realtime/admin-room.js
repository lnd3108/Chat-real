import { ADMIN_SOCKET_EVENTS, SOCKET_ROOMS } from "../../domain/constants/socket-events.js";
import { hasAdminPanelAccess } from "../../domain/rbac/access-policy.js";
import { getIo, hasIo } from "./socket-registry.js";

export const joinAdminRoom = (socket) => {
  if (hasAdminPanelAccess(socket?.user)) {
    socket.join(SOCKET_ROOMS.ADMINS);
  }
};

export const emitToAdmins = (eventName, payload) => {
  if (!hasIo() || !eventName) {
    return;
  }

  getIo().to(SOCKET_ROOMS.ADMINS).emit(eventName, payload);
};

export const emitAdminSystemNotification = (payload) => {
  emitToAdmins(ADMIN_SOCKET_EVENTS.SYSTEM_NOTIFICATION, payload);
};
