import { useEffect } from "react";
import { toast } from "sonner";

import { ADMIN_SOCKET_EVENTS } from "@/constants/adminSocketEvents";
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

    const addNotification = useAdminNotificationStore.getState().addNotification;
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
        type: payload.type ?? "system",
        title: payload.title ?? "ThÃ´ng bÃ¡o há»‡ thá»‘ng",
        message: payload.message ?? "",
        link: payload.link,
        entityId: payload.entityId,
        actor: payload.actor,
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
          : "CÃ³ thay Ä‘á»•i ngÆ°á»i dÃ¹ng má»›i",
        link: payload.user?._id ? `/admin/users/${payload.user._id}` : "/admin/users",
        entityId: payload.user?._id,
        actor: payload.actor ?? payload.user,
      });
    };

    const onUserNew = (payload: AdminUserRealtimePayload) => {
      handleUserRealtime(payload, "NgÆ°á»i dÃ¹ng má»›i");
      toast.success("CÃ³ ngÆ°á»i dÃ¹ng má»›i Ä‘Äƒng kÃ½");
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
      handleUserRealtime(payload, "TÃ i khoáº£n Ä‘Ã£ bá»‹ xÃ³a");
      toast.warning("Má»™t tÃ i khoáº£n vá»«a bá»‹ xÃ³a");
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
        message: payload.report.reason ?? "BÃ¡o cÃ¡o má»›i",
        link: `/admin/reports/${payload.report._id}`,
        entityId: payload.report._id,
        actor: payload.report.reporterSnapshot,
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
        title: "Tin nháº¯n há»— trá»£ má»›i",
        message:
          payload.message?.content ??
          payload.conversation?.lastMessage?.content ??
          "CÃ³ cáº­p nháº­t há»— trá»£ má»›i",
        link: payload.conversationId
          ? `/admin/support/${payload.conversationId}`
          : "/admin/support",
        entityId: payload.conversationId,
        actor: payload.actor ?? payload.conversation?.supportCreatedByUser,
        isRead: Boolean(isActive),
      });

      if (!isActive) {
        toast.message("CÃ³ tin nháº¯n há»— trá»£ má»›i");
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
          actor: payload.actor ?? null,
        },
      });

      addNotification({
        id: notificationId("maintenance", payload.createdAt),
        type: "system",
        title: enabled ? "ÄÃ£ báº­t báº£o trÃ¬" : "ÄÃ£ táº¯t báº£o trÃ¬",
        message: payload.message ?? "",
        link: "/admin/maintenance",
        severity: enabled ? "warning" : "success",
      });

      toast[enabled ? "warning" : "success"](
        enabled ? "Há»‡ thá»‘ng Ä‘Ã£ báº­t báº£o trÃ¬" : "Há»‡ thá»‘ng Ä‘Ã£ táº¯t báº£o trÃ¬",
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
    socket.on(ADMIN_SOCKET_EVENTS.USER_LOGIN, (payload: AdminUserRealtimePayload) =>
      handleUserRealtime(payload, "NgÆ°á»i dÃ¹ng Ä‘ang nháº­p"),
    );
    socket.on(ADMIN_SOCKET_EVENTS.USER_LOGOUT, (payload: AdminUserRealtimePayload) =>
      handleUserRealtime(payload, "NgÆ°á»i dÃ¹ng Ä‘Äƒng xuáº¥t"),
    );
    socket.on(ADMIN_SOCKET_EVENTS.USER_STATUS_CHANGED, onUserStatusChanged);
    socket.on(ADMIN_SOCKET_EVENTS.USER_LOCKED, (payload: AdminUserRealtimePayload) => {
      handleUserRealtime(payload, "TÃ i khoáº£n Ä‘Ã£ bá»‹ khÃ³a");
      toast.warning("Má»™t tÃ i khoáº£n vá»«a bá»‹ khÃ³a");
    });
    socket.on(ADMIN_SOCKET_EVENTS.USER_UNLOCKED, (payload: AdminUserRealtimePayload) => {
      handleUserRealtime(payload, "TÃ i khoáº£n Ä‘Ã£ Ä‘Æ°á»£c má»Ÿ khÃ³a");
      toast.success("Má»™t tÃ i khoáº£n vá»«a Ä‘Æ°á»£c má»Ÿ khÃ³a");
    });
    socket.on(ADMIN_SOCKET_EVENTS.USER_DELETED, onUserDeleted);
    socket.on(ADMIN_SOCKET_EVENTS.REPORT_NEW, (payload: AdminReportRealtimePayload) => {
      onReportChanged(payload, "BÃ¡o cÃ¡o má»›i");
      toast.warning("CÃ³ bÃ¡o cÃ¡o má»›i");
    });
    socket.on(ADMIN_SOCKET_EVENTS.REPORT_UPDATED, (payload: AdminReportRealtimePayload) => {
      onReportChanged(payload, "BÃ¡o cÃ¡o Ä‘Ã£ Ä‘Æ°á»£c cáº­p nháº­t");
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
      socket.off(ADMIN_SOCKET_EVENTS.SUPPORT_NEW_MESSAGE, onSupportMessage);
      socket.off(ADMIN_SOCKET_EVENTS.DASHBOARD_STATS_UPDATED, onDashboardStatsUpdated);
      socket.off(ADMIN_SOCKET_EVENTS.SYSTEM_NOTIFICATION, handleSystemNotification);
      socket.off(ADMIN_SOCKET_EVENTS.MAINTENANCE_ON);
      socket.off(ADMIN_SOCKET_EVENTS.MAINTENANCE_OFF);
      useAdminSocketStore.getState().setBoundSocketId(null);
    };
  }, [boundSocketId, socket, userRole]);
};
