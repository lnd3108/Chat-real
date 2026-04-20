import Conversation from "../models/Conversation.js";
import Report from "../models/Report.js";
import User from "../models/User.js";
import { ADMIN_SOCKET_EVENTS } from "../constants/socketEvents.js";
import { emitToAdmins } from "../socket/adminSocket.js";
import { getMaintenanceStatus } from "./maintenanceService.js";
import { getOnlineUsersCount } from "../socket/index.js";

const getTodayStart = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const getAdminDashboardRealtimeStats = async () => {
  const todayStart = getTodayStart();

  const [
    totalUsers,
    totalOnlineUsers,
    newUsersToday,
    bannedUsers,
    totalPendingReports,
    totalUnreadSupportConversations,
    latestUsers,
    maintenance,
  ] = await Promise.all([
    User.countDocuments(),
    Promise.resolve(getOnlineUsersCount()),
    User.countDocuments({ createdAt: { $gte: todayStart } }),
    User.countDocuments({ status: "banned" }),
    Report.countDocuments({ status: { $in: ["pending", "reviewing"] } }),
    Conversation.countDocuments({
      type: "support",
      supportStatus: { $in: ["open", "in_progress"] },
    }),
    User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("_id displayName userName avatarUrl status createdAt")
      .lean(),
    getMaintenanceStatus(),
  ]);

  return {
    totalUsers,
    totalOnlineUsers,
    newUsersToday,
    bannedUsers,
    totalPendingReports,
    totalUnreadSupportConversations,
    latestUsers,
    maintenance,
    updatedAt: new Date().toISOString(),
  };
};

export const emitDashboardStatsUpdated = async (context = {}) => {
  const stats = await getAdminDashboardRealtimeStats();

  emitToAdmins(ADMIN_SOCKET_EVENTS.DASHBOARD_STATS_UPDATED, {
    ...stats,
    context,
  });

  return stats;
};
