import { useEffect } from "react";
import { toast } from "sonner";

import { ADMIN_SOCKET_EVENTS } from "@/constants/adminSocketEvents";
import { useAdminDashboardStore } from "@/stores/useAdminDashboardStore";
import { useAdminNotificationStore } from "@/stores/useAdminNotificationStore";
import { useAdminSocketStore } from "@/stores/useAdminSocketStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSocketStore } from "@/stores/useSocketStore";

const notificationId = (prefix: string, entityId?: string | null) =>
  `${prefix}-${entityId ?? Date.now()}`;

export const useAdminSocket = () => {
  const socket = useSocketStore((state) => state.socket);
  const userRole = useAuthStore((state) => state.user?.role);
  const boundSocketId = useAdminSocketStore((state) => state.boundSocketId);

  useEffect(() => {
    if (!socket || userRole !== "admin") {
      return;
    }

    if (boundSocketId === socket.id) {
      return;
    }

    useAdminSocketStore.getState().setBoundSocketId(socket.id ?? "unknown");

    const addNotification =
      useAdminNotificationStore.getState().addNotification;
    const {
      upsertUser,
      removeUser,
      upsertReport,
      upsertSupportConversation,
      upsertSupportMessage,
    } = useAdminSocketStore.getState();
    const applyRealtimeStats =
      useAdminDashboardStore.getState().applyRealtimeStats;

    const handleSystemNotification = (payload: any) => {
      addNotification({
        id: payload.id ?? notificationId("admin-system", payload.entityId),
        type: payload.type ?? "system",
        title: payload.title ?? "Thong bao he thong",
        message: payload.message ?? "",
        link: payload.link,
        entityId: payload.entityId,
        actor: payload.actor,
        severity: payload.severity ?? "info",
        metadata: payload.metadata,
      });
    };

    const handleUserRealtime = (payload: any, title: string) => {
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
        message:
          payload.user?.displayName
            ? `${payload.user.displayName} (${payload.user.userName})`
            : "Co thay doi user moi",
        link: payload.user?._id ? `/admin/users/${payload.user._id}` : "/admin/users",
        entityId: payload.user?._id,
        actor: payload.actor ?? payload.user,
      });
    };

    const onUserNew = (payload: any) => {
      handleUserRealtime(payload, "Nguoi dung moi");
      toast.success("Co nguoi dung moi dang ky");
    };

    const onUserStatusChanged = (payload: any) => {
      if (payload.user) {
        upsertUser({
          ...payload.user,
          isOnline: payload.isOnline,
        });
      }
    };

    const onUserDeleted = (payload: any) => {
      if (payload.user?._id) {
        removeUser(payload.user._id);
      }
      handleUserRealtime(payload, "Tai khoan da bi xoa");
      toast.warning("Mot tai khoan vua bi xoa");
    };

    const onReportChanged = (payload: any, title: string) => {
      if (payload.report) {
        upsertReport(payload.report);
        addNotification({
          id: notificationId("report", payload.report._id),
          type: "report",
          title,
          message: payload.report.reason ?? "Bao cao moi",
          link: `/admin/reports/${payload.report._id}`,
          entityId: payload.report._id,
          actor: payload.report.reporterSnapshot,
          severity: payload.report.status === "pending" ? "warning" : "info",
        });
      }
    };

    const onSupportMessage = (payload: any) => {
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
        title: "Tin nhan ho tro moi",
        message:
          payload.message?.content ??
          payload.conversation?.lastMessage?.content ??
          "Co cap nhat ho tro moi",
        link: payload.conversationId
          ? `/admin/support/${payload.conversationId}`
          : "/admin/support",
        entityId: payload.conversationId,
        actor: payload.actor ?? payload.conversation?.supportCreatedByUser,
        isRead: Boolean(isActive),
      });

      if (!isActive) {
        toast.message("Co tin nhan ho tro moi");
      }
    };

    const onDashboardStatsUpdated = (payload: any) => {
      applyRealtimeStats(payload);
    };

    const onMaintenance = (payload: any, enabled: boolean) => {
      applyRealtimeStats({
        maintenance: {
          isEnabled: enabled,
          message: payload.message ?? "",
          enabledAt: enabled ? payload.enabledAt ?? new Date().toISOString() : null,
          disabledAt: enabled ? null : payload.disabledAt ?? new Date().toISOString(),
          actor: payload.actor ?? null,
        },
      });
      addNotification({
        id: notificationId("maintenance", payload.createdAt),
        type: "system",
        title: enabled ? "Da bat bao tri" : "Da tat bao tri",
        message: payload.message ?? "",
        link: "/admin/maintenance",
        severity: enabled ? "warning" : "success",
      });
      toast[enabled ? "warning" : "success"](
        enabled ? "He thong da bat bao tri" : "He thong da tat bao tri",
      );
    };

    socket.off(ADMIN_SOCKET_EVENTS.USER_NEW);
    socket.off(ADMIN_SOCKET_EVENTS.USER_LOGIN);
    socket.off(ADMIN_SOCKET_EVENTS.USER_LOGOUT);
    socket.off(ADMIN_SOCKET_EVENTS.USER_STATUS_CHANGED);
    socket.off(ADMIN_SOCKET_EVENTS.USER_LOCKED);
    socket.off(ADMIN_SOCKET_EVENTS.USER_UNLOCKED);
    socket.off(ADMIN_SOCKET_EVENTS.USER_DELETED);
    socket.off(ADMIN_SOCKET_EVENTS.REPORT_NEW);
    socket.off(ADMIN_SOCKET_EVENTS.REPORT_UPDATED);
    socket.off(ADMIN_SOCKET_EVENTS.SUPPORT_NEW_MESSAGE);
    socket.off(ADMIN_SOCKET_EVENTS.DASHBOARD_STATS_UPDATED);
    socket.off(ADMIN_SOCKET_EVENTS.SYSTEM_NOTIFICATION);
    socket.off(ADMIN_SOCKET_EVENTS.MAINTENANCE_ON);
    socket.off(ADMIN_SOCKET_EVENTS.MAINTENANCE_OFF);

    socket.on(ADMIN_SOCKET_EVENTS.USER_NEW, onUserNew);
    socket.on(ADMIN_SOCKET_EVENTS.USER_LOGIN, (payload) =>
      handleUserRealtime(payload, "Nguoi dung dang nhap"),
    );
    socket.on(ADMIN_SOCKET_EVENTS.USER_LOGOUT, (payload) =>
      handleUserRealtime(payload, "Nguoi dung dang xuat"),
    );
    socket.on(ADMIN_SOCKET_EVENTS.USER_STATUS_CHANGED, onUserStatusChanged);
    socket.on(ADMIN_SOCKET_EVENTS.USER_LOCKED, (payload) => {
      handleUserRealtime(payload, "Tai khoan da bi khoa");
      toast.warning("Mot tai khoan vua bi khoa");
    });
    socket.on(ADMIN_SOCKET_EVENTS.USER_UNLOCKED, (payload) => {
      handleUserRealtime(payload, "Tai khoan da duoc mo khoa");
      toast.success("Mot tai khoan vua duoc mo khoa");
    });
    socket.on(ADMIN_SOCKET_EVENTS.USER_DELETED, onUserDeleted);
    socket.on(ADMIN_SOCKET_EVENTS.REPORT_NEW, (payload) => {
      onReportChanged(payload, "Bao cao moi");
      toast.warning("Co bao cao moi");
    });
    socket.on(ADMIN_SOCKET_EVENTS.REPORT_UPDATED, (payload) => {
      onReportChanged(payload, "Bao cao da duoc cap nhat");
    });
    socket.on(ADMIN_SOCKET_EVENTS.SUPPORT_NEW_MESSAGE, onSupportMessage);
    socket.on(ADMIN_SOCKET_EVENTS.DASHBOARD_STATS_UPDATED, onDashboardStatsUpdated);
    socket.on(ADMIN_SOCKET_EVENTS.SYSTEM_NOTIFICATION, handleSystemNotification);
    socket.on(ADMIN_SOCKET_EVENTS.MAINTENANCE_ON, (payload) =>
      onMaintenance(payload, true),
    );
    socket.on(ADMIN_SOCKET_EVENTS.MAINTENANCE_OFF, (payload) =>
      onMaintenance(payload, false),
    );

    return () => {
      socket.off(ADMIN_SOCKET_EVENTS.USER_NEW, onUserNew);
      socket.off(ADMIN_SOCKET_EVENTS.USER_STATUS_CHANGED, onUserStatusChanged);
      socket.off(ADMIN_SOCKET_EVENTS.USER_DELETED, onUserDeleted);
      socket.off(ADMIN_SOCKET_EVENTS.SUPPORT_NEW_MESSAGE, onSupportMessage);
      socket.off(ADMIN_SOCKET_EVENTS.DASHBOARD_STATS_UPDATED, onDashboardStatsUpdated);
      socket.off(ADMIN_SOCKET_EVENTS.SYSTEM_NOTIFICATION, handleSystemNotification);
      socket.off(ADMIN_SOCKET_EVENTS.MAINTENANCE_ON);
      socket.off(ADMIN_SOCKET_EVENTS.MAINTENANCE_OFF);
      useAdminSocketStore.getState().setBoundSocketId(null);
    };
  }, [boundSocketId, socket, userRole]);
};
