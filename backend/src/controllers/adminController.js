import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import FriendRequest from "../models/FriendRequest.js";
import Friend from "../models/Friend.js";
import Blocking from "../models/Blocking.js";
import Session from "../models/Session.js";
import { disconnectUserSockets, emitToUser } from "../socket/index.js";

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

    const blockingCount = await Blocking.countDocuments({ userId: id });
    const blockedByCount = await Blocking.countDocuments({ blockedUserId: id });
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

// Danh sách lời mời kết bạn chưa xử lý
export const getPendingFriendRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const requests = await FriendRequest.find()
      .populate("senderId", "displayName userName email avatarUrl")
      .populate("receiverId", "displayName userName email avatarUrl")
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await FriendRequest.countDocuments();

    return res.status(200).json({
      success: true,
      data: {
        requests,
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
