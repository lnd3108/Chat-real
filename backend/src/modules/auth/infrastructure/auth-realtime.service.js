import { ADMIN_SOCKET_EVENTS } from "../../../constants/socketEvents.js";
import { emitToAdmins } from "../../../socket/adminSocket.js";
import {
  buildAdminActor,
  emitAdminNotification,
} from "../../../services/adminNotificationService.js";
import { emitDashboardStatsUpdated } from "../../../services/dashboardRealtimeService.js";
import { hasAdminPanelAccess } from "../../../services/rbacService.js";

const AUTH_LIFECYCLE_CONFIG = {
  [ADMIN_SOCKET_EVENTS.USER_NEW]: {
    title: "Nguoi dung moi dang ky",
    message: (user) => `${user.displayName} vua tao tai khoan`,
    reason: "user:register",
  },
  [ADMIN_SOCKET_EVENTS.USER_LOGIN]: {
    title: "NgÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng Ã„â€˜Ã„Æ’ng nhÃ¡ÂºÂ­p",
    message: (user) => `${user.displayName} vÃ¡Â»Â«a Ã„â€˜Ã„Æ’ng nhÃ¡ÂºÂ­p`,
    reason: "user:login",
  },
  [ADMIN_SOCKET_EVENTS.USER_LOGOUT]: {
    title: "Nguoi dung dang xuat",
    message: (user) =>
      user
        ? `${user.displayName} vua dang xuat`
        : "Mot nguoi dung vua dang xuat",
    reason: "user:logout",
  },
};

export const emitAuthLifecycle = (eventName, user) => {
  const config = AUTH_LIFECYCLE_CONFIG[eventName];
  if (!config || !user || hasAdminPanelAccess(user)) {
    return;
  }

  emitToAdmins(eventName, {
    user: buildAdminActor(user),
    changedAt: new Date().toISOString(),
  });

  emitAdminNotification({
    type: "user",
    title: config.title,
    message: config.message(user),
    link: `/admin/users/${user._id}`,
    entityId: user._id.toString(),
    actor: buildAdminActor(user),
  });

  void emitDashboardStatsUpdated({
    reason: config.reason,
    userId: user._id.toString(),
  });
};
