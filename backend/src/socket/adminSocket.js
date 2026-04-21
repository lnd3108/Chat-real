import { ADMIN_SOCKET_EVENTS, SOCKET_ROOMS } from "../constants/socketEvents.js";
import { hasAdminPanelAccess } from "../services/rbacService.js";
import { getIo } from "./index.js";

export const joinAdminRoom = (socket) => {
  if (hasAdminPanelAccess(socket?.user)) {
    socket.join(SOCKET_ROOMS.ADMINS);
  }
};

export const emitToAdmins = (eventName, payload) => {
  if (!eventName) {
    return;
  }

  getIo().to(SOCKET_ROOMS.ADMINS).emit(eventName, payload);
};

export const emitAdminSystemNotification = (payload) => {
  emitToAdmins(ADMIN_SOCKET_EVENTS.SYSTEM_NOTIFICATION, payload);
};
