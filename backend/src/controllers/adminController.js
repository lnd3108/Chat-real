import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import FriendRequest from "../models/FriendRequest.js";
import Friend from "../models/Friend.js";
import Blocking, { BLOCKING_TYPE_DIRECT_ONLY } from "../models/Blocking.js";
import Session from "../models/Session.js";
import Report from "../models/Report.js";
import {
  disconnectUserSockets,
  emitToUser,
  disconnectAllUserSockets,
  getIo,
} from "../socket/index.js";
import { permanentlyDeleteUserAccount } from "../services/accountDeletionService.js";
import { isMailConfigured, sendAccountDeletedEmail } from "../utils/mail.js";
import { emitDirectBlockStatusChanged } from "./conversationController.js";
import {
  getMaintenanceStatus,
  requestPasswordVerification,
  verifyPasswordAndPrepareConfirmation,
  sendConfirmationCode,
  verifyConfirmationCode,
  toggleMaintenanceMode,
  updateMaintenanceMessage as updateMaintenanceMessageInDb,
} from "../services/maintenanceService.js";
import { ADMIN_SOCKET_EVENTS, USER_SOCKET_EVENTS } from "../constants/socketEvents.js";
import { emitToAdmins } from "../socket/adminSocket.js";
import {
  buildAdminActor,
  emitAdminNotification,
} from "../services/adminNotificationService.js";
import {
  emitDashboardStatsUpdated,
  getAdminDashboardRealtimeStats,
} from "../services/dashboardRealtimeService.js";
import { emitReportUpdated } from "../services/reportRealtimeService.js";
import { escapeRegex } from "../utils/regex.js";
import {
  buildAdminBlockFilter,
  buildAdminFriendFilter,
  buildAdminFriendRequestFilter,
  getAdminBlockSort,
  getAdminFriendRequestSort,
  getAdminFriendSort,
  mapAdminBlockRelation,
  mapAdminFriendRelation,
  mapAdminFriendRequestRelation,
  mapAdminLastMessage,
  syncBlockingDocumentsFromEmbeddedState,
} from "../services/adminQueryHelpers.js";
import {
  buildAdminReportQuery,
  buildModerationTargetUser,
  getAdminReportSort,
  validateAdminReportStatusUpdate,
} from "../services/adminReportService.js";
import { sendError, sendServerError } from "../utils/controllerResponses.js";



const mapAdminConversationSummary = (conversation, messagesCount = 0) => ({
  _id: conversation._id,
  type: conversation.type,
  groupName: conversation.type === "group" ? conversation.group?.name ?? "Nhóm" : null,
  membersCount: Array.isArray(conversation.participants) ? conversation.participants.length : 0,
  messagesCount,
  lastMessage: mapAdminLastMessage(conversation.lastMessage),
  updatedAt: conversation.updatedAt,
  createdAt: conversation.createdAt,
});

const getAdminConversationSort = (sort = "updatedAt-desc") => {
  switch (sort) {
    case "createdAt-asc":
      return { createdAt: 1 };
    case "createdAt-desc":
      return { createdAt: -1 };
    case "updatedAt-asc":
      return { updatedAt: 1 };
    case "updatedAt-desc":
    default:
      return { updatedAt: -1 };
  }
};

const buildAdminConversationFilter = async ({ type = "", q = "" }) => {
  const filter = {
    type: { $in: ["direct", "group"] },
  };
  const trimmedType = String(type || "").trim();
  const trimmedQuery = String(q || "").trim();

  if (trimmedType && ["direct", "group"].includes(trimmedType)) {
    filter.type = trimmedType;
  }

  if (!trimmedQuery) {
    return filter;
  }

  const regex = new RegExp(escapeRegex(trimmedQuery), "i");
  const matchedUsers = await User.find({
    $or: [{ userName: regex }, { displayName: regex }, { email: regex }],
  })
    .select("_id")
    .lean();

  const matchedUserIds = matchedUsers.map((user) => user._id);
  const queryConditions = [];

  if (matchedUserIds.length) {
    queryConditions.push({ "participants.userId": { $in: matchedUserIds } });
  }

  queryConditions.push({ "group.name": regex });

  if (queryConditions.length === 0) {
    filter._id = null;
    return filter;
  }

  filter.$or = queryConditions;

  return filter;
};

const getMessagesCountMap = async (conversationIds = []) => {
  if (!conversationIds.length) {
    return new Map();
  }

  const counts = await Message.aggregate([
    {
      $match: {
        conversationId: { $in: conversationIds },
      },
    },
    {
      $group: {
        _id: "$conversationId",
        count: { $sum: 1 },
      },
    },
  ]);

  return new Map(counts.map((item) => [item._id.toString(), item.count]));
};

const getDirectBlockStatusForAdmin = async (participantIds = []) => {
  if (participantIds.length !== 2) {
    return null;
  }

  const [userAId, userBId] = participantIds;
  const activeBlocks = await Blocking.find({
    isActive: { $ne: false },
    $or: [
      { userId: userAId, blockedUserId: userBId },
      { userId: userBId, blockedUserId: userAId },
    ],
  }).lean();

  const blockedByA = activeBlocks.some(
    (block) =>
      block.userId?.toString() === userAId.toString() &&
      block.blockedUserId?.toString() === userBId.toString()
  );
  const blockedByB = activeBlocks.some(
    (block) =>
      block.userId?.toString() === userBId.toString() &&
      block.blockedUserId?.toString() === userAId.toString()
  );

  return {
    blockedByUserA: blockedByA,
    blockedByUserB: blockedByB,
    hasDirectBlock: blockedByA || blockedByB,
    note: "Block chỉ ảnh hưởng direct 1-1, không ảnh hưởng group chat.",
  };
};

// Admin Dashboard - Thống kê chung
export const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAdmins = await User.countDocuments({ role: "admin" });
    const totalConversations = await Conversation.countDocuments();
    const totalMessages = await Message.countDocuments();
    const totalFriendRequests = await FriendRequest.countDocuments();
    const totalBlocks = await Blocking.countDocuments();

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalAdmins,
        totalConversations,
        totalMessages,
        totalFriendRequests,
        totalBlocks,
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy thống kê dashboard:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy thống kê dashboard",
    });
  }
};

// Danh sách người dùng
export const getDashboardOverview = async (req, res) => {
  try {
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
      Conversation.countDocuments({
        type: "group",
        createdAt: { $gte: last7Days },
      }),
      Friend.countDocuments(),
      FriendRequest.countDocuments({
        $or: [{ status: "pending" }, { status: { $exists: false } }, { status: null }],
      }),
      Blocking.countDocuments({ isActive: { $ne: false } }),
      Report.countDocuments({ status: "pending" }),
      Report.countDocuments({ status: "reviewing" }),
      Conversation.countDocuments({ type: "support", supportStatus: "open" }),
      Conversation.countDocuments({
        type: "support",
        supportStatus: "in_progress",
      }),
      getAdminDashboardRealtimeStats(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
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
        totalUnreadSupportConversations:
          dashboardRealtime.totalUnreadSupportConversations,
        latestUsers: dashboardRealtime.latestUsers,
        maintenance: dashboardRealtime.maintenance,
      },
    });
  } catch (error) {
    console.error("Loi khi lay dashboard overview:", error);
    return res.status(500).json({
      success: false,
      message: "Khong the lay du lieu dashboard overview",
    });
  }
};

const clampDashboardDays = (value, fallback = 7) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 7) return 7;
  if (parsed <= 30) return 30;
  return 30;
};

const getDateRangeStart = (days) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
};

const buildDateBuckets = (days) => {
  const start = getDateRangeStart(days);
  return Array.from({ length: days }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);

    return {
      key: current.toISOString().slice(0, 10),
      label: current.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      }),
    };
  });
};

export const getDashboardUserChart = async (req, res) => {
  try {
    const days = clampDashboardDays(req.query.days, 7);
    const startDate = getDateRangeStart(days);
    const buckets = buildDateBuckets(days);

    const rows = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          total: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const rowMap = new Map(rows.map((row) => [row._id, row.total]));

    return res.status(200).json({
      success: true,
      data: {
        days,
        points: buckets.map((bucket) => ({
          date: bucket.key,
          label: bucket.label,
          total: rowMap.get(bucket.key) ?? 0,
        })),
      },
    });
  } catch (error) {
    console.error("Loi khi lay chart user dashboard:", error);
    return res.status(500).json({
      success: false,
      message: "Khong the lay du lieu chart nguoi dung",
    });
  }
};

export const getDashboardMessageChart = async (req, res) => {
  try {
    const days = clampDashboardDays(req.query.days, 7);
    const startDate = getDateRangeStart(days);
    const buckets = buildDateBuckets(days);

    const rows = await Message.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "_id",
          as: "conversation",
        },
      },
      {
        $unwind: "$conversation",
      },
      {
        $match: {
          "conversation.type": { $in: ["direct", "group", "support"] },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },
            type: "$conversation.type",
          },
          total: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.date": 1 },
      },
    ]);

    const rowMap = new Map(
      rows.map((row) => [`${row._id.date}:${row._id.type}`, row.total]),
    );

    return res.status(200).json({
      success: true,
      data: {
        days,
        points: buckets.map((bucket) => {
          const direct = rowMap.get(`${bucket.key}:direct`) ?? 0;
          const group = rowMap.get(`${bucket.key}:group`) ?? 0;
          const support = rowMap.get(`${bucket.key}:support`) ?? 0;

          return {
            date: bucket.key,
            label: bucket.label,
            direct,
            group,
            support,
            total: direct + group + support,
          };
        }),
      },
    });
  } catch (error) {
    console.error("Loi khi lay chart message dashboard:", error);
    return res.status(500).json({
      success: false,
      message: "Khong the lay du lieu chart tin nhan",
    });
  }
};

export const getDashboardReportChart = async (req, res) => {
  try {
    const rows = await Report.aggregate([
      {
        $group: {
          _id: "$status",
          total: { $sum: 1 },
        },
      },
    ]);

    const rowMap = new Map(rows.map((row) => [row._id, row.total]));

    return res.status(200).json({
      success: true,
      data: {
        items: [
          { status: "pending", label: "Chờ xử lý", total: rowMap.get("pending") ?? 0 },
          {
            status: "reviewing",
            label: "Đang xem xét",
            total: rowMap.get("reviewing") ?? 0,
          },
          { status: "resolved", label: "Đã xử lý", total: rowMap.get("resolved") ?? 0 },
          { status: "rejected", label: "Từ chối", total: rowMap.get("rejected") ?? 0 },
        ],
      },
    });
  } catch (error) {
    console.error("Loi khi lay chart report dashboard:", error);
    return res.status(500).json({
      success: false,
      message: "Khong the lay du lieu chart bao cao",
    });
  }
};

export const getDashboardSupportChart = async (req, res) => {
  try {
    const rows = await Conversation.aggregate([
      {
        $match: {
          type: "support",
        },
      },
      {
        $group: {
          _id: "$supportStatus",
          total: { $sum: 1 },
        },
      },
    ]);

    const rowMap = new Map(rows.map((row) => [row._id, row.total]));

    return res.status(200).json({
      success: true,
      data: {
        items: [
          { status: "open", label: "Mở", total: rowMap.get("open") ?? 0 },
          {
            status: "in_progress",
            label: "Đang xử lý",
            total: rowMap.get("in_progress") ?? 0,
          },
          {
            status: "resolved",
            label: "Đã giải quyết",
            total: rowMap.get("resolved") ?? 0,
          },
          { status: "closed", label: "Đóng", total: rowMap.get("closed") ?? 0 },
        ],
      },
    });
  } catch (error) {
    console.error("Loi khi lay chart support dashboard:", error);
    return res.status(500).json({
      success: false,
      message: "Khong the lay du lieu chart ho tro",
    });
  }
};

export const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const searchQuery = req.query.q || "";
    const status = req.query.status || "";
    const sort = req.query.sort || "createdAt";

    // Build filter object
    const filter = {};

    // Search by username, displayName, or email
    if (searchQuery.trim()) {
      filter.$or = [
        { userName: { $regex: searchQuery, $options: "i" } },
        { displayName: { $regex: searchQuery, $options: "i" } },
        { email: { $regex: searchQuery, $options: "i" } },
      ];
    }

    // Filter by status
    if (status && ["active", "inactive", "suspended", "banned"].includes(status)) {
      filter.status = status;
    }

    // Build sort object
    let sortObj = {};
    if (sort === "username") {
      sortObj = { userName: 1 };
    } else if (sort === "displayName") {
      sortObj = { displayName: 1 };
    } else {
      sortObj = { createdAt: -1 };
    }

    // Execute query
    const users = await User.find(filter)
      .select("-hashedPassword -emailVerificationCodeHash -accountDeletionCodeHash")
      .limit(limit)
      .skip(skip)
      .sort(sortObj);

    const total = await User.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách người dùng:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách người dùng",
    });
  }
};

// Lấy thông tin người dùng
export const getUserDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select(
      "-hashedPassword -emailVerificationCodeHash -accountDeletionCodeHash"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Người dùng không tồn tại",
      });
    }

    // Get statistics
    const friendsCount = await Friend.countDocuments({
      $or: [{ userA: id }, { userB: id }],
    });

    const directConversationsCount = await Conversation.countDocuments({
      "participants.userId": id,
      type: "direct",
    });

    const groupConversationsCount = await Conversation.countDocuments({
      "participants.userId": id,
      type: "group",
    });

    const blockingCount = await Blocking.countDocuments({
      userId: id,
      isActive: { $ne: false },
    });
    const blockedByCount = await Blocking.countDocuments({
      blockedUserId: id,
      isActive: { $ne: false },
    });
    const messagesCount = await Message.countDocuments({ senderId: id });

    return res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          avatar: user.avatarUrl ?? null,
          username: user.userName,
          displayName: user.displayName,
          email: user.email,
          status: user.status,
          createdAt: user.createdAt,
          role: user.role,
        },
        stats: {
          friendsCount,
          directConversationsCount,
          groupConversationsCount,
          blockingCount,
          blockedByCount,
          messagesCount,
        },
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy thông tin người dùng:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin người dùng",
    });
  }
};

// Cập nhật role người dùng
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role không hợp lệ",
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select("-hashedPassword -emailVerificationCodeHash -accountDeletionCodeHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Người dùng không tồn tại",
      });
    }

    emitToAdmins(ADMIN_SOCKET_EVENTS.USER_DELETED, {
      user: buildAdminActor(user),
      actor: buildAdminActor(req.user),
      changedAt: new Date().toISOString(),
      summary,
    });
    emitAdminNotification({
      type: "user",
      title: "Tai khoan da bi xoa",
      message: `${req.user.displayName} vua xoa @${user.userName}`,
      link: "/admin/users",
      entityId: user._id.toString(),
      actor: buildAdminActor(req.user),
      severity: "warning",
    });
    await emitDashboardStatsUpdated({
      reason: "user:deleted",
      userId: user._id.toString(),
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật role thành công",
      data: user,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật role:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật role",
    });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const adminUserId = req.user?._id?.toString();

    if (!["active", "banned"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ. Chỉ hỗ trợ `active` hoặc `banned`.",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Người dùng không tồn tại.",
      });
    }

    if (adminUserId && adminUserId === user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Bạn không thể tự khóa tài khoản của chính mình.",
      });
    }

    user.status = status;
    await user.save();

    if (status === "banned") {
      await Session.deleteMany({ userId: user._id });
      emitToUser(user._id, USER_SOCKET_EVENTS.ACCOUNT_LOCKED, {
        message: "Tai khoan cua ban da bi khoa boi quan tri vien.",
      });
      emitToUser(user._id, "account:banned", {
        message: "Tài khoản của bạn đã bị khóa bởi quản trị viên.",
      });
      disconnectUserSockets(user._id);
      emitToAdmins(ADMIN_SOCKET_EVENTS.USER_LOCKED, {
        user: buildAdminActor(user),
        actor: buildAdminActor(req.user),
        changedAt: new Date().toISOString(),
      });
      emitAdminNotification({
        type: "user",
        title: "Tai khoan da bi khoa",
        message: `${req.user.displayName} vua khoa @${user.userName}`,
        link: `/admin/users/${user._id}`,
        entityId: user._id.toString(),
        actor: buildAdminActor(req.user),
      });
    } else {
      emitToUser(user._id, USER_SOCKET_EVENTS.ACCOUNT_UNLOCKED, {
        message: "Tai khoan cua ban da duoc mo khoa.",
      });
      emitToAdmins(ADMIN_SOCKET_EVENTS.USER_UNLOCKED, {
        user: buildAdminActor(user),
        actor: buildAdminActor(req.user),
        changedAt: new Date().toISOString(),
      });
      emitAdminNotification({
        type: "user",
        title: "Tai khoan da duoc mo khoa",
        message: `${req.user.displayName} vua mo khoa @${user.userName}`,
        link: `/admin/users/${user._id}`,
        entityId: user._id.toString(),
        actor: buildAdminActor(req.user),
      });
    }

    emitToAdmins(ADMIN_SOCKET_EVENTS.USER_STATUS_CHANGED, {
      user: buildAdminActor(user),
      changedAt: new Date().toISOString(),
    });
    await emitDashboardStatsUpdated({
      reason: status === "banned" ? "user:locked" : "user:unlocked",
      userId: user._id.toString(),
    });

    return res.status(200).json({
      success: true,
      message:
        status === "banned"
          ? "Đã khóa tài khoản người dùng."
          : "Đã mở khóa tài khoản người dùng.",
      data: {
        user: {
          _id: user._id,
          avatar: user.avatarUrl ?? null,
          username: user.userName,
          displayName: user.displayName,
          email: user.email,
          status: user.status,
          createdAt: user.createdAt,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái người dùng:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật trạng thái người dùng.",
    });
  }
};

export const deleteUserAsAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const adminUserId = req.user?._id?.toString();
    const reason =
      typeof req.body?.reason === "string" && req.body.reason.trim()
        ? req.body.reason.trim()
        : null;

    if (adminUserId && adminUserId === id) {
      return res.status(400).json({
        success: false,
        message: "Bạn không thể tự xóa tài khoản của chính mình từ khu vực admin.",
      });
    }

    const { user, summary } = await permanentlyDeleteUserAccount({
      targetUserId: id,
      actorUserId: req.user?._id ?? null,
      initiatedBy: "admin",
      reason,
    });

    try {
      await sendAccountDeletedEmail({
        email: user.email,
        displayName: user.displayName,
        deletedByAdmin: true,
        reason,
      });
    } catch (mailError) {
      console.error("Lỗi gửi email sau khi admin xóa tài khoản", mailError);
    }

    return res.status(200).json({
      success: true,
      message: "Tài khoản đã được xóa.",
      data: summary,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Không thể xóa tài khoản.",
    });
  }
};

// Danh sách lời mời kết bạn chưa xử lý
export const getFriendRequestsAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const q = req.query.q || "";
    const status = req.query.status || "";
    const sort = req.query.sort || "createdAt-desc";
    const filter = await buildAdminFriendRequestFilter({ q, status });

    const requests = await FriendRequest.find(filter)
      .populate("from", "displayName userName email avatarUrl")
      .populate("to", "displayName userName email avatarUrl")
      .limit(limit)
      .skip(skip)
      .sort(getAdminFriendRequestSort(sort));

    const total = await FriendRequest.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: {
        requests: requests.map(mapAdminFriendRequestRelation),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách lời mời kết bạn:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách lời mời kết bạn",
    });
  }
};

export const getFriendships = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const q = req.query.q || "";
    const sort = req.query.sort || "createdAt-desc";
    const filter = await buildAdminFriendFilter({ q });

    const friendships = await Friend.find(filter)
      .populate("userA", "displayName userName email avatarUrl")
      .populate("userB", "displayName userName email avatarUrl")
      .limit(limit)
      .skip(skip)
      .sort(getAdminFriendSort(sort));

    const total = await Friend.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: {
        friendships: friendships.map(mapAdminFriendRelation),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Loi khi lay danh sach friendship da accepted:", error);
    return res.status(500).json({
      success: false,
      message: "Khong the lay danh sach friendship da accepted",
    });
  }
};

// Danh sách các cuộc trò chuyện
export const getConversations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const type = req.query.type || "";
    const q = req.query.q || "";
    const sort = req.query.sort || "updatedAt-desc";
    const filter = await buildAdminConversationFilter({ type, q });

    const conversations = await Conversation.find(filter)
      .limit(limit)
      .skip(skip)
      .sort(getAdminConversationSort(sort));

    const total = await Conversation.countDocuments(filter);
    const conversationIds = conversations.map((conversation) => conversation._id);
    const messagesCountMap = await getMessagesCountMap(conversationIds);

    return res.status(200).json({
      success: true,
      data: {
        conversations: conversations.map((conversation) =>
          mapAdminConversationSummary(
            conversation,
            messagesCountMap.get(conversation._id.toString()) ?? 0
          )
        ),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách cuộc trò chuyện:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách cuộc trò chuyện",
    });
  }
};

// Danh sách tin nhắn
export const getMessages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const messages = await Message.find()
      .populate("senderId", "displayName userName email avatarUrl")
      .populate("conversationId", "conversationName conversationType")
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await Message.countDocuments();

    return res.status(200).json({
      success: true,
      data: {
        messages,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách tin nhắn:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách tin nhắn",
    });
  }
};

// Danh sách các khối người dùng
export const getBlockedUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const blocks = await Blocking.find()
      .populate("userId", "displayName userName email avatarUrl")
      .populate("blockedUserId", "displayName userName email avatarUrl")
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await Blocking.countDocuments();

    return res.status(200).json({
      success: true,
      data: {
        blocks,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách khối người dùng:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách khối người dùng",
    });
  }
};

export const getConversationDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id)
      .populate("participants.userId", "displayName userName email avatarUrl")
      .populate("group.createdBy", "displayName userName email avatarUrl");

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Cuộc trò chuyện không tồn tại.",
      });
    }

    const messagesCount = await Message.countDocuments({
      conversationId: conversation._id,
    });

    const members = (conversation.participants || []).map((participant) => ({
      _id: participant.userId?._id ?? null,
      displayName: participant.userId?.displayName ?? null,
      userName: participant.userId?.userName ?? null,
      email: participant.userId?.email ?? null,
      avatarUrl: participant.userId?.avatarUrl ?? null,
      joinedAt: participant.joinedAt ?? null,
    }));

    const participantIds = members.map((member) => member._id).filter(Boolean);
    const directBlockStatus =
      conversation.type === "direct"
        ? await getDirectBlockStatusForAdmin(participantIds)
        : null;

    return res.status(200).json({
      success: true,
      data: {
        conversation: {
          _id: conversation._id,
          type: conversation.type,
          groupName: conversation.type === "group" ? conversation.group?.name ?? "Nhóm" : null,
          creator:
            conversation.type === "group" && conversation.group?.createdBy
              ? {
                  _id: conversation.group.createdBy._id,
                  displayName: conversation.group.createdBy.displayName,
                  userName: conversation.group.createdBy.userName,
                  email: conversation.group.createdBy.email ?? null,
                  avatarUrl: conversation.group.createdBy.avatarUrl ?? null,
                }
              : null,
          members,
          membersCount: members.length,
          messagesCount,
          lastMessage: mapAdminLastMessage(conversation.lastMessage),
          updatedAt: conversation.updatedAt,
          createdAt: conversation.createdAt,
          directBlockStatus,
          note:
            conversation.type === "group"
              ? "Group chat vẫn hoạt động bình thường kể cả khi một số thành viên block nhau ở direct."
              : "Block status ở đây chỉ phản ánh direct 1-1 giữa hai thành viên.",
        },
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy chi tiết cuộc trò chuyện:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy chi tiết cuộc trò chuyện",
    });
  }
};

export const getBlocks = async (req, res) => {
  try {
    await syncBlockingDocumentsFromEmbeddedState();

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || "createdAt-desc";
    const q = req.query.q || "";
    const status = req.query.status || "";
    const filter = await buildAdminBlockFilter({ q, status });

    const blocks = await Blocking.find(filter)
      .populate("userId", "displayName userName email avatarUrl")
      .populate("blockedUserId", "displayName userName email avatarUrl")
      .limit(limit)
      .skip(skip)
      .sort(getAdminBlockSort(sort));

    const total = await Blocking.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: {
        blocks: blocks.map(mapAdminBlockRelation),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        auditNote:
          "Block relation chỉ áp dụng cho direct 1-1. Group chat không bị ảnh hưởng.",
      },
    });
  } catch (error) {
    console.error("Loi khi lay danh sach quan he chan:", error);
    return res.status(500).json({
      success: false,
      message: "Khong the lay danh sach quan he chan",
    });
  }
};

export const getBlockDetail = async (req, res) => {
  try {
    await syncBlockingDocumentsFromEmbeddedState();

    const { id } = req.params;
    const block = await Blocking.findById(id)
      .populate("userId", "displayName userName email avatarUrl")
      .populate("blockedUserId", "displayName userName email avatarUrl");

    if (!block) {
      return res.status(404).json({
        success: false,
        message: "Quan he chan khong ton tai.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        block: mapAdminBlockRelation(block),
        auditNote:
          "Block relation chỉ áp dụng cho direct 1-1. Group chat không bị ảnh hưởng.",
      },
    });
  } catch (error) {
    console.error("Loi khi lay chi tiet quan he chan:", error);
    return res.status(500).json({
      success: false,
      message: "Khong the lay chi tiet quan he chan.",
    });
  }
};

export const unblockBlockRelationAsAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const currentBlock = await Blocking.findById(id).select(
      "userId blockedUserId isActive"
    );

    if (!currentBlock) {
      return res.status(404).json({
        success: false,
        message: "Quan he chan khong ton tai.",
      });
    }

    if (currentBlock.isActive === false) {
      return res.status(400).json({
        success: false,
        message: "Quan he chan nay da o trang thai inactive.",
      });
    }

    const unblockedAt = new Date();

    const [updatedBlock] = await Promise.all([
      Blocking.findByIdAndUpdate(
        id,
        {
          $set: {
            isActive: false,
            unblockedAt,
            type: BLOCKING_TYPE_DIRECT_ONLY,
          },
        },
        { new: true }
      )
        .populate("userId", "displayName userName email avatarUrl")
        .populate("blockedUserId", "displayName userName email avatarUrl"),
      User.findByIdAndUpdate(currentBlock.userId, {
        $pull: { blockedUsers: { userId: currentBlock.blockedUserId } },
      }),
    ]);

    await emitDirectBlockStatusChanged({
      blockerUserId: currentBlock.userId,
      blockedUserId: currentBlock.blockedUserId,
      isBlocked: false,
    });

    return res.status(200).json({
      success: true,
      message: "Admin da go block relation thanh cong.",
      data: {
        block: mapAdminBlockRelation(updatedBlock),
      },
    });
  } catch (error) {
    console.error("Loi khi admin go block relation:", error);
    return res.status(500).json({
      success: false,
      message: "Khong the go block relation.",
    });
  }
};

// ========== QUAN LY BAO CAO ==========

export const getReports = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, targetType, q, sort = "createdAt-desc" } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = buildAdminReportQuery({ status, targetType, q });
    const sortObj = getAdminReportSort(sort);

    const reports = await Report.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .populate("reporterId", "displayName userName avatarUrl")
      .populate("targetUserId", "displayName userName avatarUrl")
      .populate("reviewedByAdminId", "displayName userName")
      .lean();

    const total = await Report.countDocuments(query);

    res.json({
      message: "Lấy danh sách báo cáo thành công",
      data: {
        reports,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    return sendServerError(res, error, {
      logMessage: "Lỗi khi lấy danh sách báo cáo:",
      message: "Không thể lấy danh sách báo cáo",
    });
  }
};

export const getReportDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await Report.findById(id)
      .populate("reporterId", "displayName userName email avatarUrl")
      .populate("targetUserId", "displayName userName email avatarUrl status")
      .populate({
        path: "targetMessageId",
        select: "content imgUrl senderId senderDisplayName createdAt",
        populate: {
          path: "senderId",
          select: "displayName userName email avatarUrl status",
        },
      })
      .populate("targetConversationId", "type groupName members createdAt")
      .populate("reviewedByAdminId", "displayName userName email")
      .lean();

    if (!report) {
      return sendError(res, 404, "Không tìm thấy báo cáo");
    }

    let moderationTargetUser = null;

    if (report.targetUserId) {
      moderationTargetUser = {
        _id: report.targetUserId._id,
        displayName:
          report.targetUserId.displayName ??
          report.targetUserSnapshot?.displayName ??
          "Người dùng đã xóa",
        userName:
          report.targetUserId.userName ??
          report.targetUserSnapshot?.userName ??
          "deleted-user",
        email: report.targetUserId.email ?? report.targetUserSnapshot?.email ?? null,
        avatarUrl:
          report.targetUserId.avatarUrl ?? report.targetUserSnapshot?.avatarUrl ?? null,
        status: report.targetUserId.status ?? "active",
        source: "target_user",
      };
    } else if (report.targetType === "message") {
      const sender = report.targetMessageId?.senderId;

      if (sender) {
        moderationTargetUser = {
          _id: sender._id,
          displayName: sender.displayName ?? report.targetMessagePreview?.senderDisplayName ?? "Người gửi",
          userName: sender.userName ?? "unknown",
          email: sender.email ?? null,
          avatarUrl: sender.avatarUrl ?? null,
          status: sender.status ?? "active",
          source: "message_sender",
        };
      } else if (report.targetMessagePreview?.senderDisplayName) {
        moderationTargetUser = {
          _id: null,
          displayName: report.targetMessagePreview.senderDisplayName,
          userName: "deleted-user",
          email: null,
          avatarUrl: null,
          status: "deleted",
          source: "message_sender_deleted",
        };
      }
    }

    moderationTargetUser = buildModerationTargetUser(report) ?? moderationTargetUser;

    res.json({
      message: "Lấy chi tiết báo cáo thành công",
      data: {
        report,
        moderationTargetUser,
      },
    });
  } catch (error) {
    return sendServerError(res, error, {
      logMessage: "Lỗi khi lấy chi tiết báo cáo:",
      message: "Không thể lấy chi tiết báo cáo",
    });
  }
};

export const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;
    const adminId = req.user._id;

    const validationError = validateAdminReportStatusUpdate({ status, resolutionNote });
    if (validationError) {
      return sendError(res, 400, validationError);
    }

    const updateData = {
      status,
      reviewedByAdminId: adminId,
      reviewedAt: new Date(),
    };

    if (resolutionNote) {
      updateData.resolutionNote = resolutionNote.trim();
    }

    const report = await Report.findByIdAndUpdate(id, updateData, { new: true })
      .populate("reporterId", "displayName userName avatarUrl")
      .populate("targetUserId", "displayName userName avatarUrl")
      .populate("reviewedByAdminId", "displayName userName")
      .lean();

    if (!report) {
      return sendError(res, 404, "Không tìm thấy báo cáo");
    }

    await emitReportUpdated(report._id, {
      action: "status-updated",
      actorId: adminId.toString(),
    });

    res.json({
      message: "Cập nhật trạng thái báo cáo thành công",
      data: { report },
    });
  } catch (error) {
    return sendServerError(res, error, {
      logMessage: "Lỗi khi cập nhật trạng thái báo cáo:",
      message: "Không thể cập nhật trạng thái báo cáo",
    });
  }
};

export const resolveReportWithAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, resolutionNote } = req.body;
    const adminId = req.user._id;

    const report = await Report.findById(id);
    if (!report) {
      return sendError(res, 404, "Không tìm thấy báo cáo");
    }

    let actionResult = null;

    // Xử lý hành động tương ứng với báo cáo
    if (action === "ban-user" && report.targetUserId) {
      await User.findByIdAndUpdate(report.targetUserId, { status: "banned" });
      actionResult = "Đã khóa người dùng";
    } else if (action === "unban-user" && report.targetUserId) {
      await User.findByIdAndUpdate(report.targetUserId, { status: "active" });
      actionResult = "Đã mở khóa người dùng";
    } else if (action === "delete-account" && report.targetUserId) {
      // Tạm thời đánh dấu tài khoản để xử lý tiếp theo
      await User.findByIdAndUpdate(report.targetUserId, { status: "inactive" });
      actionResult = "Đã đánh dấu tài khoản để xóa";
    } else if (action === "delete-message" && report.targetMessageId) {
      await Message.findByIdAndUpdate(report.targetMessageId, { isDeletedForEveryone: true });
      actionResult = "Đã xóa tin nhắn";
    }

    // Cập nhật trạng thái báo cáo
    const updateData = {
      status: "resolved",
      reviewedByAdminId: adminId,
      reviewedAt: new Date(),
    };

    if (resolutionNote) {
      updateData.resolutionNote = `[${action}] ${resolutionNote.trim()}`;
    } else {
      updateData.resolutionNote = `[${action}] Đã xử lý theo hành động`;
    }

    const updatedReport = await Report.findByIdAndUpdate(id, updateData, { new: true })
      .populate("reporterId", "displayName userName avatarUrl")
      .populate("targetUserId", "displayName userName avatarUrl")
      .populate("reviewedByAdminId", "displayName userName")
      .lean();

    await emitReportUpdated(updatedReport._id, {
      action,
      actorId: adminId.toString(),
    });

    res.json({
      message: "Xử lý báo cáo bằng hành động thành công",
      data: {
        report: updatedReport,
        action: actionResult,
      },
    });
  } catch (error) {
    return sendServerError(res, error, {
      logMessage: "Lỗi khi xử lý báo cáo bằng hành động:",
      message: "Không thể xử lý báo cáo bằng hành động",
    });
  }
};

// ==================== MAINTENANCE MODE ENDPOINTS ====================

export const getSystemHealth = async (req, res) => {
  try {
    const health = {
      status: "healthy",
      checks: {
        database: true,
        smtp: isMailConfigured(),
      },
    };

    if (!health.checks.smtp) {
      health.status = "warning";
      health.message = "SMTP chưa được cấu hình - không thể gửi email";
    }

    return res.status(200).json(health);
  } catch (error) {
    console.error("Error checking system health:", error);
    return res.status(500).json({
      status: "unhealthy",
      message: error.message,
    });
  }
};

export const getMaintenanceInfo = async (req, res) => {
  try {
    const status = await getMaintenanceStatus();
    return res.status(200).json(status);
  } catch (error) {
    console.error("Lỗi khi lấy thông tin bảo trì:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Step 1: Request password verification
export const requestMaintenancePasswordVerification = async (req, res) => {
  try {
    const adminId = req.user._id;
    const admin = await User.findById(adminId).select("hashedPassword email");

    if (!admin) {
      return res.status(404).json({ message: "Không tìm thấy quản trị viên" });
    }

    // For testing purposes, you might want to return the code
    // In production, only admin should request it and check email
    return res.status(200).json({
      message: "Yêu cầu xác minh mật khẩu đã được tạo. Vui lòng kiểm tra email.",
      email: admin.email,
    });
  } catch (error) {
    console.error("Lỗi khi yêu cầu xác minh mật khẩu:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Step 2: Verify admin password and send confirmation code
export const verifyMaintenancePassword = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Thiếu mật khẩu" });
    }

    const admin = await User.findById(adminId).select("hashedPassword email");
    if (!admin) {
      return res.status(404).json({ message: "Không tìm thấy quản trị viên" });
    }

    // Kiểm tra mật khẩu
    const isPasswordValid = await verifyPasswordAndPrepareConfirmation(
      password,
      admin.hashedPassword
    );

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Mật khẩu không chính xác" });
    }

    // Gửi mã xác nhận
    const result = await sendConfirmationCode(admin.email);
    if (!result.ok) {
      return res.status(500).json({ message: result.message });
    }

    return res.status(200).json({
      message: "Mã xác nhận đã được gửi tới email của bạn",
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error("Lỗi khi xác minh mật khẩu bảo trì:", {
      adminId: req.user?._id,
      error: error.message,
      code: error.code,
      stack: error.stack,
    });
    
    // Trả về thông báo cụ thể theo loại lỗi
    if (error.message?.includes("SMTP")) {
      return res.status(500).json({ message: "Hệ thống email chưa được cấu hình. Vui lòng liên hệ với quản trị viên." });
    }
    
    return res.status(500).json({ message: "Lỗi hệ thống: " + error.message });
  }
};

// Bước 3: Xác minh mã xác nhận và bật/tắt chế độ bảo trì
export const confirmMaintenanceToggle = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { code, enable } = req.body;

    if (!code || typeof enable !== "boolean") {
      return res
        .status(400)
        .json({ message: "Thiếu code hoặc giá trị enable" });
    }

    // Kiểm tra mã xác nhận
    const verifyResult = await verifyConfirmationCode(code);
    if (!verifyResult.ok) {
      return res.status(400).json({
        message: verifyResult.message,
        attempts: verifyResult.attempts,
        maxAttempts: verifyResult.maxAttempts,
      });
    }

    // Bật hoặc tắt chế độ bảo trì
    const result = await toggleMaintenanceMode(adminId, enable);

    // Nếu bật bảo trì thì ngắt kết nối toàn bộ người dùng không phải admin
    if (enable) {
      const message = result.message;
      disconnectAllUserSockets(message);
    }

    const actor = await User.findById(adminId).select(
      "displayName userName email avatarUrl role status createdAt",
    );
    const maintenancePayload = {
      isEnabled: result.isEnabled,
      message: result.message,
      enabledAt: result.enabledAt,
      disabledAt: result.disabledAt,
      actor: buildAdminActor(actor),
      createdAt: new Date().toISOString(),
    };

    emitToAdmins(
      enable ? ADMIN_SOCKET_EVENTS.MAINTENANCE_ON : ADMIN_SOCKET_EVENTS.MAINTENANCE_OFF,
      maintenancePayload,
    );
    emitAdminNotification({
      type: "system",
      title: enable ? "Da bat maintenance mode" : "Da tat maintenance mode",
      message:
        enable
          ? `${actor?.displayName ?? "Admin"} vua bat che do bao tri`
          : `${actor?.displayName ?? "Admin"} vua tat che do bao tri`,
      link: "/admin/maintenance",
      actor: buildAdminActor(actor),
      severity: enable ? "warning" : "success",
    });
    getIo().emit(
      enable ? USER_SOCKET_EVENTS.SYSTEM_MAINTENANCE_ON : USER_SOCKET_EVENTS.SYSTEM_MAINTENANCE_OFF,
      { message: result.message, isEnabled: result.isEnabled },
    );
    await emitDashboardStatsUpdated({
      reason: enable ? "maintenance:on" : "maintenance:off",
    });

    return res.status(200).json({
      message: enable
        ? "Bảo trì hệ thống đã được bật"
        : "Bảo trì hệ thống đã được tắt",
      isEnabled: result.isEnabled,
      enabledAt: result.enabledAt,
      disabledAt: result.disabledAt,
    });
  } catch (error) {
    console.error("Lỗi khi xác nhận thay đổi trạng thái bảo trì:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Cập nhật thông báo bảo trì
export const updateMaintenanceMessage = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ message: "Tin nhắn bảo trì không hợp lệ" });
    }

    const result = await updateMaintenanceMessageInDb(message.trim());
    await emitDashboardStatsUpdated({ reason: "maintenance:message-updated" });

    return res.status(200).json({
      message: "Tin nhắn bảo trì đã được cập nhật",
      maintenanceMessage: result.message,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật thông báo bảo trì:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
