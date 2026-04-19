import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import FriendRequest from "../models/FriendRequest.js";
import Friend from "../models/Friend.js";
import Blocking, { BLOCKING_TYPE_DIRECT_ONLY } from "../models/Blocking.js";
import Session from "../models/Session.js";
import { disconnectUserSockets, emitToUser } from "../socket/index.js";
import { permanentlyDeleteUserAccount } from "../services/accountDeletionService.js";
import { sendAccountDeletedEmail } from "../utils/mail.js";
import { emitDirectBlockStatusChanged } from "./conversationController.js";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const mapAdminUserSummary = (user) => {
  if (!user) return null;

  return {
    _id: user._id,
    displayName: user.displayName,
    userName: user.userName,
    email: user.email ?? null,
    avatarUrl: user.avatarUrl ?? null,
  };
};

const mapAdminBlockRelation = (block) => ({
  _id: block._id,
  blocker: mapAdminUserSummary(block.userId),
  blockedUser: mapAdminUserSummary(block.blockedUserId),
  isActive: block.isActive !== false,
  createdAt: block.createdAt,
  unblockedAt: block.unblockedAt ?? null,
  type: block.type ?? BLOCKING_TYPE_DIRECT_ONLY,
  reason: block.reason ?? null,
});

const getAdminBlockSort = (sort = "createdAt-desc") => {
  switch (sort) {
    case "createdAt-asc":
      return { createdAt: 1 };
    case "blocker-asc":
      return { userId: 1, createdAt: -1 };
    case "blocked-asc":
      return { blockedUserId: 1, createdAt: -1 };
    case "status":
      return { isActive: -1, createdAt: -1 };
    case "createdAt-desc":
    default:
      return { createdAt: -1 };
  }
};

const syncBlockingDocumentsFromEmbeddedState = async () => {
  const usersWithBlocks = await User.find({
    "blockedUsers.0": { $exists: true },
  })
    .select("_id blockedUsers")
    .lean();

  if (!usersWithBlocks.length) {
    return;
  }

  const operations = [];

  usersWithBlocks.forEach((user) => {
    (user.blockedUsers ?? []).forEach((entry) => {
      if (!entry?.userId) {
        return;
      }

      operations.push({
        updateOne: {
          filter: {
            userId: user._id,
            blockedUserId: entry.userId,
          },
          update: {
            $set: {
              reason: entry.reason ?? null,
              isActive: true,
              unblockedAt: null,
              type: BLOCKING_TYPE_DIRECT_ONLY,
              createdAt: entry.createdAt ?? new Date(),
            },
          },
          upsert: true,
        },
      });
    });
  });

  if (!operations.length) {
    return;
  }

  await Blocking.bulkWrite(operations, { ordered: false });
};

const buildAdminBlockFilter = async ({ q = "", status = "" }) => {
  const filter = {};

  if (status === "active") {
    filter.isActive = { $ne: false };
  } else if (status === "inactive") {
    filter.isActive = false;
  }

  const trimmedQuery = String(q || "").trim();
  if (!trimmedQuery) {
    return filter;
  }

  const regex = new RegExp(escapeRegex(trimmedQuery), "i");
  const matchedUsers = await User.find({
    $or: [
      { userName: regex },
      { displayName: regex },
      { email: regex },
    ],
  })
    .select("_id")
    .lean();

  const matchedUserIds = matchedUsers.map((user) => user._id);

  if (!matchedUserIds.length) {
    filter._id = null;
    return filter;
  }

  filter.$or = [
    { userId: { $in: matchedUserIds } },
    { blockedUserId: { $in: matchedUserIds } },
  ];

  return filter;
};

const mapAdminFriendRelation = (friendship) => ({
  _id: friendship._id,
  userA: mapAdminUserSummary(friendship.userA),
  userB: mapAdminUserSummary(friendship.userB),
  status: "accepted",
  createdAt: friendship.createdAt,
});

const getAdminFriendSort = (sort = "createdAt-desc") => {
  switch (sort) {
    case "createdAt-asc":
      return { createdAt: 1 };
    case "createdAt-desc":
    default:
      return { createdAt: -1 };
  }
};

const buildAdminFriendFilter = async ({ q = "" }) => {
  const filter = {};
  const trimmedQuery = String(q || "").trim();

  if (!trimmedQuery) {
    return filter;
  }

  const regex = new RegExp(escapeRegex(trimmedQuery), "i");
  const matchedUsers = await User.find({
    $or: [{ userName: regex }, { displayName: regex }],
  })
    .select("_id")
    .lean();

  const matchedUserIds = matchedUsers.map((user) => user._id);

  if (!matchedUserIds.length) {
    filter._id = null;
    return filter;
  }

  filter.$or = [
    { userA: { $in: matchedUserIds } },
    { userB: { $in: matchedUserIds } },
  ];

  return filter;
};

const mapAdminFriendRequestRelation = (request) => ({
  _id: request._id,
  fromUser: mapAdminUserSummary(request.from),
  toUser: mapAdminUserSummary(request.to),
  message: request.message ?? "",
  status: request.status ?? "pending",
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
});

const getAdminFriendRequestSort = (sort = "createdAt-desc") => {
  switch (sort) {
    case "createdAt-asc":
      return { createdAt: 1 };
    case "updatedAt-desc":
      return { updatedAt: -1 };
    case "status":
      return { status: 1, createdAt: -1 };
    case "createdAt-desc":
    default:
      return { createdAt: -1 };
  }
};

const buildAdminFriendRequestFilter = async ({ q = "", status = "" }) => {
  const filter = {};
  const trimmedStatus = String(status || "").trim();
  const trimmedQuery = String(q || "").trim();

  if (trimmedStatus && ["pending", "accepted", "rejected", "cancelled"].includes(trimmedStatus)) {
    if (trimmedStatus === "pending") {
      filter.$and = [
        {
          $or: [{ status: "pending" }, { status: { $exists: false } }, { status: null }],
        },
      ];
    } else {
      filter.status = trimmedStatus;
    }
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

  if (!matchedUserIds.length) {
    filter._id = null;
    return filter;
  }

  const participantFilter = {
    $or: [
    { from: { $in: matchedUserIds } },
    { to: { $in: matchedUserIds } },
    ],
  };

  if (filter.$and) {
    filter.$and.push(participantFilter);
  } else {
    Object.assign(filter, participantFilter);
  }

  return filter;
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
      emitToUser(user._id, "account:banned", {
        message: "Tài khoản của bạn đã bị khóa bởi quản trị viên.",
      });
      disconnectUserSockets(user._id);
    }

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

    const conversations = await Conversation.find()
      .populate("participants", "displayName userName email avatarUrl")
      .populate("createdBy", "displayName userName email")
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await Conversation.countDocuments();

    return res.status(200).json({
      success: true,
      data: {
        conversations,
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
