import { buildAdminActor, emitAdminNotification } from "./adminNotificationService.js";
import { emitDashboardStatsUpdated } from "./dashboardRealtimeService.js";
import { emitSupportConversationRealtimeEvent } from "../shared/infrastructure/realtime/support-realtime.js";

export const emitSupportConversationRealtime = async ({
  type,
  conversation,
  message = null,
  actor = null,
}) => {
  const payload = emitSupportConversationRealtimeEvent({
    type,
    conversation,
    message,
    actor,
    buildAdminActor,
  });

  emitAdminNotification({
    type: "support",
    title: "Co tin nhan ho tro moi",
    message:
      type === "reply"
        ? "Admin vua tra loi mot yeu cau ho tro"
        : "Nguoi dung vua gui mot tin nhan ho tro moi",
    link: conversation?._id ? `/admin/support/${conversation._id}` : "/admin/support",
    entityId: conversation?._id?.toString?.() ?? null,
    actor: buildAdminActor(actor ?? conversation?.supportCreatedByUser),
    metadata: {
      supportStatus: conversation?.supportStatus,
      lastMessagePreview:
        message?.content ?? conversation?.lastMessage?.content ?? null,
    },
  });

  await emitDashboardStatsUpdated({
    reason: "support:message",
    conversationId: conversation?._id?.toString?.() ?? null,
  });
};
