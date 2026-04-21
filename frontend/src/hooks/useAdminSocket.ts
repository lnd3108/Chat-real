import { useEffect } from "react";
import { toast } from "sonner";

import { ADMIN_SOCKET_EVENTS } from "@/constants/adminSocketEvents";
import { hasAdminPanelAccess } from "@/lib/rbac";
import { useAdminDashboardStore } from "@/stores/useAdminDashboardStore";
import { useAdminNotificationStore } from "@/stores/useAdminNotificationStore";
import { useAdminSocketStore } from "@/stores/useAdminSocketStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSocketStore } from "@/stores/useSocketStore";
import type {
  AdminMaintenanceRealtimePayload,
  AdminReportRealtimePayload,
  AdminSupportRealtimePayload,
  AdminSystemNotificationPayload,
  AdminUserRealtimePayload,
} from "@/types/admin";

const notificationId = (prefix: string, entityId?: string | null) =>
  `${prefix}-${entityId ?? Date.now()}`;

const toNotificationActor = (value: unknown) =>
  typeof value === "object" && value !== null
    ? (value as {
        _id?: string;
        displayName?: string;
        userName?: string;
        avatarUrl?: string | null;
      })
    : null;

export const useAdminSocket = () => {
  const socket = useSocketStore((state) => state.socket);
  const user = useAuthStore((state) => state.user);
  const boundSocketId = useAdminSocketStore((state) => state.boundSocketId);

  useEffect(() => {
    if (!socket || !hasAdminPanelAccess(user)) {
      return;
    }

    if (boundSocketId === socket.id) {
      return;
    }

    useAdminSocketStore.getState().setBoundSocketId(socket.id ?? "unknown");

    const addNotification = useAdminNotificationStore.getState().addNotification;
    const setUser = useAuthStore.getState().setUser;
    const {
      upsertUser,
      removeUser,
      upsertReport,
      upsertSupportConversation,
      upsertSupportMessage,
    } = useAdminSocketStore.getState();
    const applyRealtimeStats =
      useAdminDashboardStore.getState().applyRealtimeStats;

    const handleSystemNotification = (payload: AdminSystemNotificationPayload) => {
      addNotification({
        id: payload.id ?? notificationId("admin-system", payload.entityId),
        type:
          payload.type === "user" ||
          payload.type === "report" ||
          payload.type === "support" ||
          payload.type === "system"
            ? payload.type
            : "system",
        title: payload.title ?? "Thông báo hệ thống",
        message: payload.message ?? "",
        link: payload.link,
        entityId: payload.entityId,
        actor: toNotificationActor(payload.actor),
        severity: payload.severity ?? "info",
        metadata: payload.metadata,
      });
    };

    const handleUserRealtime = (
      payload: AdminUserRealtimePayload,
      title: string,
    ) => {
      if (payload.user) {
        upsertUser({
          ...payload.user,
          isOnline:
            typeof payload.isOnline === "boolean"
              ? payload.isOnline
              : payload.status === "online",
        });
      }

      addNotification({
        id: notificationId(title.toLowerCase(), payload.user?._id),
        type: "user",
        title,
        message: payload.user?.displayName
          ? `${payload.user.displayName} (${payload.user.userName})`
          : "Có thay đổi người dùng mới",
        link: payload.user?._id ? `/admin/users/${payload.user._id}` : "/admin/users",
        entityId: payload.user?._id,
        actor: toNotificationActor(payload.actor ?? payload.user),
      });
    };

    const onUserNew = (payload: AdminUserRealtimePayload) => {
      handleUserRealtime(payload, "Người dùng mới");
      toast.success("Có người dùng mới đăng ký");
    };

    const onUserStatusChanged = (payload: AdminUserRealtimePayload) => {
      if (payload.user) {
        upsertUser({
          ...payload.user,
          isOnline: payload.isOnline,
        });
      }
    };

    const onUserDeleted = (payload: AdminUserRealtimePayload) => {
      if (payload.user?._id) {
        removeUser(payload.user._id);
      }
      handleUserRealtime(payload, "Tài khoản đã bị xóa");
      toast.warning("Một tài khoản vừa bị xóa");
    };

    const onUserRoleUpdated = (payload: AdminUserRealtimePayload) => {
      if (payload.user) {
        upsertUser(payload.user);
      }

      const currentUser = useAuthStore.getState().user;
      if (currentUser?._id && payload.user?._id === currentUser._id) {
        setUser({
          ...currentUser,
          ...payload.user,
        });
      }

      addNotification({
        id: notificationId("user-role-updated", payload.user?._id ?? payload.userId),
        type: "user",
        title: "Quyền tài khoản đã thay đổi",
        message: payload.user?.displayName
          ? `${payload.user.displayName} đã được cập nhật quyền`
          : "Có thay đổi quyền tài khoản",
        link: payload.user?._id ? `/admin/users/${payload.user._id}` : "/admin/users",
        entityId: payload.user?._id ?? payload.userId,
        actor: toNotificationActor(payload.updatedBy ?? payload.actor),
        severity: "warning",
        metadata: {
          oldRoles: payload.oldRoles,
          newRoles: payload.newRoles,
          reason: payload.reason,
        },
      });
    };

    const onReportChanged = (
      payload: AdminReportRealtimePayload,
      title: string,
    ) => {
      if (!payload.report) {
        return;
      }

      upsertReport(payload.report);
      addNotification({
        id: notificationId("report", payload.report._id),
        type: "report",
        title,
        message: payload.report.reason ?? "Báo cáo mới",
        link: `/admin/reports/${payload.report._id}`,
        entityId: payload.report._id,
        actor: toNotificationActor(payload.report.reporterSnapshot),
        severity: payload.report.status === "pending" ? "warning" : "info",
      });
    };

    const onSupportMessage = (payload: AdminSupportRealtimePayload) => {
      if (payload.conversation) {
        upsertSupportConversation(payload.conversation);
      }
      if (payload.message && payload.conversationId) {
        upsertSupportMessage(payload.conversationId, payload.message);
      }

      const isActive =
        payload.conversationId &&
        useAdminSocketStore.getState().activeSupportConversationId ===
          payload.conversationId;

      addNotification({
        id: notificationId("support", payload.conversationId),
        type: "support",
        title: "Tin nhắn hỗ trợ mới",
        message:
          payload.message?.content ??
          payload.conversation?.lastMessage?.content ??
          "Có cập nhật hỗ trợ mới",
        link: payload.conversationId
          ? `/admin/support/${payload.conversationId}`
          : "/admin/support",
        entityId: payload.conversationId,
        actor: toNotificationActor(payload.actor ?? payload.conversation?.supportCreatedByUser),
        isRead: Boolean(isActive),
      });

      if (!isActive) {
        toast.message("Có tin nhắn hỗ trợ mới");
      }
    };

    const onDashboardStatsUpdated = (payload: Record<string, unknown>) => {
      applyRealtimeStats(payload);
    };

    const onMaintenance = (
      payload: AdminMaintenanceRealtimePayload,
      enabled: boolean,
    ) => {
      applyRealtimeStats({
        maintenance: {
          isEnabled: enabled,
          message: payload.message ?? "",
          enabledAt: enabled ? payload.enabledAt ?? new Date().toISOString() : null,
          disabledAt: enabled ? null : payload.disabledAt ?? new Date().toISOString(),
          actor: toNotificationActor(payload.actor),
        },
      });

      addNotification({
        id: notificationId("maintenance", payload.createdAt),
        type: "system",
        title: enabled ? "Đã bật bảo trì" : "Đã tắt bảo trì",
        message: payload.message ?? "",
        link: "/admin/maintenance",
        severity: enabled ? "warning" : "success",
      });

      toast[enabled ? "warning" : "success"](
        enabled ? "Hệ thống đã bật bảo trì" : "Hệ thống đã tắt bảo trì",
      );
    };

    socket.off(ADMIN_SOCKET_EVENTS.USER_NEW);
    socket.off(ADMIN_SOCKET_EVENTS.USER_LOGIN);
    socket.off(ADMIN_SOCKET_EVENTS.USER_LOGOUT);
    socket.off(ADMIN_SOCKET_EVENTS.USER_STATUS_CHANGED);
    socket.off(ADMIN_SOCKET_EVENTS.USER_LOCKED);
    socket.off(ADMIN_SOCKET_EVENTS.USER_UNLOCKED);
    socket.off(ADMIN_SOCKET_EVENTS.USER_DELETED);
    socket.off(ADMIN_SOCKET_EVENTS.USER_ROLE_UPDATED);
    socket.off(ADMIN_SOCKET_EVENTS.REPORT_NEW);
    socket.off(ADMIN_SOCKET_EVENTS.REPORT_UPDATED);
    socket.off(ADMIN_SOCKET_EVENTS.SUPPORT_NEW_MESSAGE);
    socket.off(ADMIN_SOCKET_EVENTS.DASHBOARD_STATS_UPDATED);
    socket.off(ADMIN_SOCKET_EVENTS.SYSTEM_NOTIFICATION);
    socket.off(ADMIN_SOCKET_EVENTS.MAINTENANCE_ON);
    socket.off(ADMIN_SOCKET_EVENTS.MAINTENANCE_OFF);

    socket.on(ADMIN_SOCKET_EVENTS.USER_NEW, onUserNew);
    socket.on(ADMIN_SOCKET_EVENTS.USER_LOGIN, (payload: AdminUserRealtimePayload) =>
      handleUserRealtime(payload, "Người dùng đang nhập"),
    );
    socket.on(ADMIN_SOCKET_EVENTS.USER_LOGOUT, (payload: AdminUserRealtimePayload) =>
      handleUserRealtime(payload, "Người dùng đăng xuất"),
    );
    socket.on(ADMIN_SOCKET_EVENTS.USER_STATUS_CHANGED, onUserStatusChanged);
    socket.on(ADMIN_SOCKET_EVENTS.USER_LOCKED, (payload: AdminUserRealtimePayload) => {
      handleUserRealtime(payload, "Tài khoản đã bị khóa");
      toast.warning("Một tài khoản vừa bị khóa");
    });
    socket.on(ADMIN_SOCKET_EVENTS.USER_UNLOCKED, (payload: AdminUserRealtimePayload) => {
      handleUserRealtime(payload, "Tài khoản đã được mở khóa");
      toast.success("Một tài khoản vừa được mở khóa");
    });
    socket.on(ADMIN_SOCKET_EVENTS.USER_DELETED, onUserDeleted);
    socket.on(ADMIN_SOCKET_EVENTS.USER_ROLE_UPDATED, onUserRoleUpdated);
    socket.on(ADMIN_SOCKET_EVENTS.REPORT_NEW, (payload: AdminReportRealtimePayload) => {
      onReportChanged(payload, "Báo cáo mới");
      toast.warning("Có báo cáo mới");
    });
    socket.on(ADMIN_SOCKET_EVENTS.REPORT_UPDATED, (payload: AdminReportRealtimePayload) => {
      onReportChanged(payload, "Báo cáo đã được cập nhật");
    });
    socket.on(ADMIN_SOCKET_EVENTS.SUPPORT_NEW_MESSAGE, onSupportMessage);
    socket.on(ADMIN_SOCKET_EVENTS.DASHBOARD_STATS_UPDATED, onDashboardStatsUpdated);
    socket.on(ADMIN_SOCKET_EVENTS.SYSTEM_NOTIFICATION, handleSystemNotification);
    socket.on(ADMIN_SOCKET_EVENTS.MAINTENANCE_ON, (payload: AdminMaintenanceRealtimePayload) =>
      onMaintenance(payload, true),
    );
    socket.on(
      ADMIN_SOCKET_EVENTS.MAINTENANCE_OFF,
      (payload: AdminMaintenanceRealtimePayload) => onMaintenance(payload, false),
    );

    return () => {
      socket.off(ADMIN_SOCKET_EVENTS.USER_NEW, onUserNew);
      socket.off(ADMIN_SOCKET_EVENTS.USER_STATUS_CHANGED, onUserStatusChanged);
      socket.off(ADMIN_SOCKET_EVENTS.USER_DELETED, onUserDeleted);
      socket.off(ADMIN_SOCKET_EVENTS.USER_ROLE_UPDATED, onUserRoleUpdated);
      socket.off(ADMIN_SOCKET_EVENTS.SUPPORT_NEW_MESSAGE, onSupportMessage);
      socket.off(ADMIN_SOCKET_EVENTS.DASHBOARD_STATS_UPDATED, onDashboardStatsUpdated);
      socket.off(ADMIN_SOCKET_EVENTS.SYSTEM_NOTIFICATION, handleSystemNotification);
      socket.off(ADMIN_SOCKET_EVENTS.MAINTENANCE_ON);
      socket.off(ADMIN_SOCKET_EVENTS.MAINTENANCE_OFF);
    };
  }, [boundSocketId, socket, user]);
};
