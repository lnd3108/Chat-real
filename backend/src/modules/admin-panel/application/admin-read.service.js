import User from "../../../models/User.js";
import Conversation from "../../../models/Conversation.js";
import Message from "../../../models/Message.js";
import FriendRequest from "../../../models/FriendRequest.js";
import Friend from "../../../models/Friend.js";
import Blocking, {
  BLOCKING_TYPE_DIRECT_ONLY,
} from "../../../models/Blocking.js";
import Report from "../../../models/Report.js";
import { emitDirectBlockStatusChanged } from "../../chat/application/conversation.command-service.js";
import { invalidateFriendCacheForUsers } from "../../friendship/infrastructure/cache/friend-cache.service.js";
import {
  invalidateAdminDashboardCache,
  wrapAdminDashboardCache,
} from "../infrastructure/cache/admin-dashboard-cache.service.js";
import { escapeRegex } from "../../../utils/regex.js";
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
} from "../../../services/adminQueryHelpers.js";

/// Các hàm tiện ích cho Admin Panel
// Giới hạn số ngày để tránh truy vấn quá lớn
const clampDashboardDays = (value, fallback = 7) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 7) return 7;
  if (parsed <= 30) return 30;
  return 30;
};

// Lấy ngày bắt đầu của khoảng thời gian dựa trên số ngày mong muốn
const getDateRangeStart = (days) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
};

// Xây dựng các bucket ngày cho biểu đồ, đảm bảo có đủ bucket cho mỗi ngày trong khoảng thời gian
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

// Ánh xạ thông tin cuộc trò chuyện cho admin, bao gồm cả số lượng tin nhắn và thông tin block nếu là direct chat
const mapAdminConversationSummary = (conversation, messagesCount = 0) => ({
  _id: conversation._id,
  type: conversation.type,
  groupName:
    conversation.type === "group"
      ? (conversation.group?.name ?? "NhÃ³m")
      : null,
  membersCount: Array.isArray(conversation.participants)
    ? conversation.participants.length
    : 0,
  messagesCount,
  lastMessage: mapAdminLastMessage(conversation.lastMessage),
  updatedAt: conversation.updatedAt,
  createdAt: conversation.createdAt,
});

// Xác định thứ tự sắp xếp cho cuộc trò chuyện dựa trên tham số sort
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

// Xây dựng bộ lọc cho truy vấn cuộc trò chuyện trong admin panel, hỗ trợ lọc theo loại và tìm kiếm theo tên người dùng hoặc tên nhóm
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

// Lấy số lượng tin nhắn cho mỗi cuộc trò chuyện trong
// danh sách cuộc trò chuyện của admin panel,
// sử dụng aggregation để đếm số lượng tin nhắn theo conversationId
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

// Kiểm tra trạng thái block trực tiếp giữa hai người
// dùng trong cuộc trò chuyện direct, trả về thông tin ai block ai và ghi chú cho admin
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
      block.blockedUserId?.toString() === userBId.toString(),
  );
  const blockedByB = activeBlocks.some(
    (block) =>
      block.userId?.toString() === userBId.toString() &&
      block.blockedUserId?.toString() === userAId.toString(),
  );

  return {
    blockedByUserA: blockedByA,
    blockedByUserB: blockedByB,
    hasDirectBlock: blockedByA || blockedByB,
    note: "Block chỉ ảnh hưởng direct 1-1, không ảnh hưởng group chat.",
  };
};

// Các hàm tiện ích khác như parsePage và parseLimit để đảm bảo giá trị hợp lệ cho phân trang
const parsePage = (value, fallback = 1) =>
  Number.parseInt(value, 10) || fallback;
const parseLimit = (value, fallback = 20, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
};
//Các hàm lấy dữ liệu chính của biểu đồ
const loadDashboardUserChartData = async ({ days: daysValue }) => {
  const days = clampDashboardDays(daysValue, 7);
  const startDate = getDateRangeStart(days);
  const buckets = buildDateBuckets(days);

  // Đếm số lượng người dùng mới theo ngày
  const rows = await User.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
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
    { $sort: { _id: 1 } },
  ]);

  // Tạo một Map để dễ dàng tra cứu số lượng người dùng mới theo ngày
  const rowMap = new Map(rows.map((row) => [row._id, row.total]));

  return {
    days,
    points: buckets.map((bucket) => ({
      date: bucket.key,
      label: bucket.label,
      total: rowMap.get(bucket.key) ?? 0,
    })),
  };
};

// lấy dữ liệu cho biểu đồ tin nhắn, đếm số lượng tin nhắn mới theo ngày
const loadDashboardMessageChartData = async ({ days: daysValue }) => {
  const days = clampDashboardDays(daysValue, 7);
  const startDate = getDateRangeStart(days);
  const buckets = buildDateBuckets(days);

  // Đếm số lượng tin nhắn mới theo ngày, phân loại theo loại cuộc trò chuyện (direct, group, support)
  const rows = await Message.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $lookup: {
        from: "conversations",
        localField: "conversationId",
        foreignField: "_id",
        as: "conversation",
      },
    },
    { $unwind: "$conversation" },
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
    { $sort: { "_id.date": 1 } },
  ]);

  // map mới tra cứu số lượng tin nhắn mới theo ngày
  const rowMap = new Map(
    rows.map((row) => [`${row._id.date}:${row._id.type}`, row.total]),
  );

  return {
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
  };
};

// dữ liệu biểu đồ báo cáo
const loadDashboardReportChartData = async () => {
  const rows = await Report.aggregate([
    {
      $group: {
        _id: "$status",
        total: { $sum: 1 },
      },
    },
  ]);

  // tạo map để tra cứu số lượng báo cáo theo trạng thái
  const rowMap = new Map(rows.map((row) => [row._id, row.total]));

  // trả về dữ liệu cho biểu đồ báo cáo, với các trạng thái phổ biến và số lượng tương ứng
  return {
    items: [
      {
        status: "pending",
        label: "Chờ xử lý",
        total: rowMap.get("pending") ?? 0,
      },
      {
        status: "reviewing",
        label: "Đang xem xét",
        total: rowMap.get("reviewing") ?? 0,
      },
      {
        status: "resolved",
        label: "Đã xử lý",
        total: rowMap.get("resolved") ?? 0,
      },
      {
        status: "rejected",
        label: "Từ chối",
        total: rowMap.get("rejected") ?? 0,
      },
    ],
  };
};

// dữ liệu biểu đồ hỗ trợ, đếm số lượng cuộc trò chuyện hỗ trợ theo trạng thái
const loadDashboardSupportChartData = async () => {
  const rows = await Conversation.aggregate([
    { $match: { type: "support" } },
    {
      $group: {
        _id: "$supportStatus",
        total: { $sum: 1 },
      },
    },
  ]);

  const rowMap = new Map(rows.map((row) => [row._id, row.total]));

  return {
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
  };
};

export const getDashboardUserChartData = async ({ days }) =>
  wrapAdminDashboardCache({
    type: "chart:users",
    query: { days },
    fetcher: () => loadDashboardUserChartData({ days }),
  });

export const getDashboardMessageChartData = async ({ days }) =>
  wrapAdminDashboardCache({
    type: "chart:messages",
    query: { days },
    fetcher: () => loadDashboardMessageChartData({ days }),
  });

export const getDashboardReportChartData = async () =>
  wrapAdminDashboardCache({
    type: "chart:reports",
    fetcher: loadDashboardReportChartData,
  });

export const getDashboardSupportChartData = async () =>
  wrapAdminDashboardCache({
    type: "chart:support",
    fetcher: loadDashboardSupportChartData,
  });

// Các hàm truy vấn dữ liệu cho các trang quản lý trong admin panel, hỗ trợ phân trang, lọc và sắp xếp
export const getFriendRequestsAdminQuery = async ({ query }) => {
  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);
  const skip = (page - 1) * limit;
  const q = query.q || "";
  const status = query.status || "";
  const sort = query.sort || "createdAt-desc";
  const filter = await buildAdminFriendRequestFilter({ q, status });

  // danh sách yê cầu kết bạn, thông tin người gửi, người nhận
  const requests = await FriendRequest.find(filter)
    .populate("from", "displayName userName email avatarUrl")
    .populate("to", "displayName userName email avatarUrl")
    .limit(limit)
    .skip(skip)
    .sort(getAdminFriendRequestSort(sort));

  const total = await FriendRequest.countDocuments(filter);

  return {
    requests: requests.map(mapAdminFriendRequestRelation),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// danh sách bạn bè, thông tin người A, người B, hỗ trợ phân trang, lọc theo tìm kiếm và sắp xếp
export const getFriendshipsAdminQuery = async ({ query }) => {
  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);
  const skip = (page - 1) * limit;
  const q = query.q || "";
  const sort = query.sort || "createdAt-desc";
  const filter = await buildAdminFriendFilter({ q });

  const friendships = await Friend.find(filter)
    .populate("userA", "displayName userName email avatarUrl")
    .populate("userB", "displayName userName email avatarUrl")
    .limit(limit)
    .skip(skip)
    .sort(getAdminFriendSort(sort));

  const total = await Friend.countDocuments(filter);

  return {
    friendships: friendships.map(mapAdminFriendRelation),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// danh sách cuộc trò chuyện
export const getConversationsAdminQuery = async ({ query }) => {
  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);
  const skip = (page - 1) * limit;
  const type = query.type || "";
  const q = query.q || "";
  const sort = query.sort || "updatedAt-desc";
  const filter = await buildAdminConversationFilter({ type, q });

  const conversations = await Conversation.find(filter)
    .limit(limit)
    .skip(skip)
    .sort(getAdminConversationSort(sort));

  const total = await Conversation.countDocuments(filter);
  const conversationIds = conversations.map((conversation) => conversation._id);
  const messagesCountMap = await getMessagesCountMap(conversationIds);

  return {
    conversations: conversations.map((conversation) =>
      mapAdminConversationSummary(
        conversation,
        messagesCountMap.get(conversation._id.toString()) ?? 0,
      ),
    ),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// danh sách tin nhắn, thông tin người gửi, cuộc trò chuyện, hỗ trợ phân trang, lọc theo tìm kiếm và sắp xếp
export const getAdminMessagesQuery = async ({ query }) => {
  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);
  const skip = (page - 1) * limit;

  // danh sách tin nhắn, ....
  const messages = await Message.find()
    .populate("senderId", "displayName userName email avatarUrl")
    .populate("conversationId", "conversationName conversationType")
    .limit(limit)
    .skip(skip)
    .sort({ createdAt: -1 });

  const total = await Message.countDocuments();

  return {
    messages,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// danh sách người bị chặn và thông tin
export const getAdminBlockedUsersQuery = async ({ query }) => {
  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);
  const skip = (page - 1) * limit;

  const blocks = await Blocking.find()
    .populate("userId", "displayName userName email avatarUrl")
    .populate("blockedUserId", "displayName userName email avatarUrl")
    .limit(limit)
    .skip(skip)
    .sort({ createdAt: -1 });

  const total = await Blocking.countDocuments();

  return {
    blocks,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// chi tiết cuộc trò chuyện
export const getConversationDetailAdminQuery = async ({ conversationId }) => {
  const conversation = await Conversation.findById(conversationId)
    .populate("participants.userId", "displayName userName email avatarUrl")
    .populate("group.createdBy", "displayName userName email avatarUrl");

  if (!conversation) {
    const error = new Error("Cuộc trò chuyện không tồn tại.");
    error.status = 404;
    throw error;
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

  return {
    conversation: {
      _id: conversation._id,
      type: conversation.type,
      groupName:
        conversation.type === "group"
          ? (conversation.group?.name ?? "Nhóm")
          : null,
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
  };
};

// danh sách quan hệ block
export const getBlocksAdminQuery = async ({ query }) => {
  await syncBlockingDocumentsFromEmbeddedState();

  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);
  const skip = (page - 1) * limit;
  const sort = query.sort || "createdAt-desc";
  const q = query.q || "";
  const status = query.status || "";
  const filter = await buildAdminBlockFilter({ q, status });

  const blocks = await Blocking.find(filter)
    .populate("userId", "displayName userName email avatarUrl")
    .populate("blockedUserId", "displayName userName email avatarUrl")
    .limit(limit)
    .skip(skip)
    .sort(getAdminBlockSort(sort));

  const total = await Blocking.countDocuments(filter);

  return {
    blocks: blocks.map(mapAdminBlockRelation),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    auditNote:
      "Block relation chỉ áp dụng cho direct 1-1. Group chat không bị ảnh hưởng.",
  };
};

// chi tiết quan hệ block
export const getBlockDetailAdminQuery = async ({ blockId }) => {
  await syncBlockingDocumentsFromEmbeddedState();

  const block = await Blocking.findById(blockId)
    .populate("userId", "displayName userName email avatarUrl")
    .populate("blockedUserId", "displayName userName email avatarUrl");

  if (!block) {
    const error = new Error("Quan hệ chặn không tồn tại.");
    error.status = 404;
    throw error;
  }

  return {
    block: mapAdminBlockRelation(block),
    auditNote:
      "Block relation chỉ áp dụng cho direct 1-1. Group chat không bị ảnh hưởng.",
  };
};

// bỏ chặn một quan hệ block
export const unblockBlockRelationAsAdminCommand = async ({ blockId }) => {
  const currentBlock = await Blocking.findById(blockId).select(
    "userId blockedUserId isActive",
  );

  if (!currentBlock) {
    const error = new Error("Quan hệ chặn không tồn tại.");
    error.status = 404;
    throw error;
  }

  if (currentBlock.isActive === false) {
    const error = new Error("Quan hệ chặn này đã ở trạng thái inactive.");
    error.status = 400;
    throw error;
  }

  const unblockedAt = new Date();

  const [updatedBlock] = await Promise.all([
    Blocking.findByIdAndUpdate(
      blockId,
      {
        $set: {
          isActive: false,
          unblockedAt,
          type: BLOCKING_TYPE_DIRECT_ONLY,
        },
      },
      { new: true },
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
  await invalidateFriendCacheForUsers(
    [currentBlock.userId, currentBlock.blockedUserId],
    "admin-unblocked-user",
  );
  await invalidateAdminDashboardCache("admin-unblocked-user");

  return {
    block: mapAdminBlockRelation(updatedBlock),
  };
};

// cập nhật vai trò người dùng, chỉ cho phép "user" hoặc "admin"
export const updateUserRoleLegacyCommand = async ({ userId, role }) => {
  if (!["user", "admin"].includes(role)) {
    const error = new Error("Role không hợp lệ");
    error.status = 400;
    throw error;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { role },
    { new: true },
  ).select(
    "-hashedPassword -emailVerificationCodeHash -accountDeletionCodeHash",
  );

  if (!user) {
    const error = new Error("Người dùng không tồn tại");
    error.status = 404;
    throw error;
  }
  await invalidateAdminDashboardCache("admin-user-role-updated");

  return user;
};
