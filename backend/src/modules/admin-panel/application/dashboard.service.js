import Conversation from "../../../models/Conversation.js";
import FriendRequest from "../../../models/FriendRequest.js";
import Message from "../../../models/Message.js";
import User from "../../../models/User.js";
import Blocking from "../../../models/Blocking.js";
import Friend from "../../../models/Friend.js";
import { buildAdminStaffQuery } from "../../../services/rbacService.js";
import { getAdminDashboardRealtimeStats } from "../../../services/dashboardRealtimeService.js";

export const getDashboardStatsSummary = async () => {
  const [totalUsers, totalAdmins, totalConversations, totalMessages, totalFriendRequests, totalBlocks] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments(buildAdminStaffQuery()),
      Conversation.countDocuments(),
      Message.countDocuments(),
      FriendRequest.countDocuments(),
      Blocking.countDocuments(),
    ]);

  return {
    totalUsers,
    totalAdmins,
    totalConversations,
    totalMessages,
    totalFriendRequests,
    totalBlocks,
  };
};

export const getDashboardOverviewSummary = async () => {
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const [
    totalUsers,
    activeUsers,
    bannedUsers,
    newUsersLast7Days,
    totalDirectConversations,
    totalGroupConversations,
    totalSupportConversations,
    totalMessages,
    newGroupsLast7Days,
    totalAcceptedFriends,
    totalPendingFriendRequests,
    totalActiveBlocks,
    totalPendingReports,
    totalReviewingReports,
    totalOpenSupportConversations,
    totalInProgressSupportConversations,
    dashboardRealtime,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: "active" }),
    User.countDocuments({ status: "banned" }),
    User.countDocuments({ createdAt: { $gte: last7Days } }),
    Conversation.countDocuments({ type: "direct" }),
    Conversation.countDocuments({ type: "group" }),
    Conversation.countDocuments({ type: "support" }),
    Message.countDocuments(),
    Conversation.countDocuments({ type: "group", createdAt: { $gte: last7Days } }),
    Friend.countDocuments(),
    FriendRequest.countDocuments({
      $or: [{ status: "pending" }, { status: { $exists: false } }, { status: null }],
    }),
    Blocking.countDocuments({ isActive: { $ne: false } }),
    (await import("../../../models/Report.js")).default.countDocuments({ status: "pending" }),
    (await import("../../../models/Report.js")).default.countDocuments({ status: "reviewing" }),
    Conversation.countDocuments({ type: "support", supportStatus: "open" }),
    Conversation.countDocuments({ type: "support", supportStatus: "in_progress" }),
    getAdminDashboardRealtimeStats(),
  ]);

  return {
    totalUsers,
    activeUsers,
    bannedUsers,
    deletedUsers: 0,
    newUsersLast7Days,
    totalDirectConversations,
    totalGroupConversations,
    totalSupportConversations,
    totalMessages,
    newGroupsLast7Days,
    totalAcceptedFriends,
    totalPendingFriendRequests,
    totalActiveBlocks,
    totalPendingReports,
    totalReviewingReports,
    totalOpenSupportConversations,
    totalInProgressSupportConversations,
    totalOnlineUsers: dashboardRealtime.totalOnlineUsers,
    newUsersToday: dashboardRealtime.newUsersToday,
    totalUnreadSupportConversations: dashboardRealtime.totalUnreadSupportConversations,
    latestUsers: dashboardRealtime.latestUsers,
    maintenance: dashboardRealtime.maintenance,
  };
};
