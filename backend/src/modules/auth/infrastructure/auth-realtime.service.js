import { ADMIN_SOCKET_EVENTS } from "../../../constants/socketEvents.js";
import { emitToAdmins } from "../../../socket/adminSocket.js";
import {
  buildAdminActor,
  emitAdminNotification,
} from "../../../services/adminNotificationService.js";
import { emitDashboardStatsUpdated } from "../../../services/dashboardRealtimeService.js";
import { hasAdminPanelAccess } from "../../../services/rbacService.js";

// Cấu hình các sự kiện liên quan đến vòng đời người dùng và thông tin hiển thị cho admin
const AUTH_LIFECYCLE_CONFIG = {
  [ADMIN_SOCKET_EVENTS.USER_NEW]: {
    title: "Người dùng mới đăng ký",
    message: (user) => `${user.displayName} vừa tạo tài khoản`,
    reason: "user:register",
  },
  [ADMIN_SOCKET_EVENTS.USER_LOGIN]: {
    title: "Người dùng đăng nhập",
    message: (user) => `${user.displayName} vừa đăng nhập`,
    reason: "user:login",
  },
  [ADMIN_SOCKET_EVENTS.USER_LOGOUT]: {
    title: "Người dùng đăng xuất",
    message: (user) =>
      user
        ? `${user.displayName} vừa đăng xuất`
        : "Một người dùng vừa đăng xuất",
    reason: "user:logout",
  },
};

// Hàm phát sự kiện vòng đời người dùng đến admin
export const emitAuthLifecycle = (eventName, user) => {
  const config = AUTH_LIFECYCLE_CONFIG[eventName];
  if (!config || !user || hasAdminPanelAccess(user)) {
    return;
  }

  // Phát sự kiện đến admin và cập nhật thông tin hiển thị
  emitToAdmins(eventName, {
    user: buildAdminActor(user),
    changedAt: new Date().toISOString(),
  });

  // Phát thông báo đến admin và cập nhật thống kê dashboard
  emitAdminNotification({
    type: "user",
    title: config.title,
    message: config.message(user),
    link: `/admin/users/${user._id}`,
    entityId: user._id.toString(),
    actor: buildAdminActor(user),
  });

  // Cập nhật thống kê dashboard cho admin
  void emitDashboardStatsUpdated({
    reason: config.reason,
    userId: user._id.toString(),
  });
};
