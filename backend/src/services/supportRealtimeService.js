import { ADMIN_SOCKET_EVENTS, USER_SOCKET_EVENTS } from "../constants/socketEvents.js";
import { emitToAdmins } from "../socket/adminSocket.js";
import { emitToUser } from "../socket/index.js";
import { buildAdminActor, emitAdminNotification } from "./adminNotificationService.js";
import { emitDashboardStatsUpdated } from "./dashboardRealtimeService.js";

export const emitSupportConversationRealtime = async ({
  type,
  conversation,
  message = null,
  actor = null,
}) => {
  const payload = {
    conversationId: conversation?._id,
    conversation,
    message,
    actor: buildAdminActor(actor),
    createdAt: new Date().toISOString(),
  };

  emitToAdmins(ADMIN_SOCKET_EVENTS.SUPPORT_NEW_MESSAGE, payload);

  const targetUserId =
    conversation?.supportCreatedByUser?._id ??
    conversation?.supportCreatedByUserId ??
    null;

  if (type === "reply" && targetUserId) {
    emitToUser(targetUserId, USER_SOCKET_EVENTS.SUPPORT_REPLY_NEW, payload);
  }

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
