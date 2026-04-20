import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { emitToUser, getIo } from "../socket/index.js";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SUPPORT_STATUS_SET = ["open", "in_progress", "resolved", "closed"];

const populateSupportConversation = async (conversation) => {
  await conversation.populate([
    {
      path: "participants.userId",
      select: "displayName userName avatarUrl email role",
    },
    {
      path: "supportCreatedByUserId",
      select: "displayName userName avatarUrl email role",
    },
    {
      path: "assignedAdminId",
      select: "displayName userName avatarUrl email role",
    },
  ]);

  return conversation;
};

const formatSupportParticipants = (participants = []) =>
  participants.map((participant) => ({
    _id: participant.userId?._id ?? participant.userId ?? null,
    displayName: participant.userId?.displayName ?? null,
    userName: participant.userId?.userName ?? null,
    avatarUrl: participant.userId?.avatarUrl ?? null,
    email: participant.userId?.email ?? null,
    role: participant.userId?.role ?? null,
    joinedAt: participant.joinedAt,
  }));

const toPlainUnreadCounts = (unreadCounts) =>
  unreadCounts instanceof Map ? Object.fromEntries(unreadCounts) : unreadCounts || {};

const formatSupportConversation = (conversation) => {
  const plainConversation =
    typeof conversation.toObject === "function" ? conversation.toObject() : conversation;

  return {
    ...plainConversation,
    participants: formatSupportParticipants(plainConversation.participants),
    supportCreatedByUser:
      plainConversation.supportCreatedByUserId &&
      typeof plainConversation.supportCreatedByUserId === "object"
        ? plainConversation.supportCreatedByUserId
        : null,
    assignedAdmin:
      plainConversation.assignedAdminId && typeof plainConversation.assignedAdminId === "object"
        ? plainConversation.assignedAdminId
        : null,
    unreadCounts: toPlainUnreadCounts(plainConversation.unreadCounts),
  };
};

const buildSupportConversationSocketPayload = (conversation) => ({
  _id: conversation._id,
  type: "support",
  participants: conversation.participants,
  supportStatus: conversation.supportStatus,
  supportCreatedByUserId:
    conversation.supportCreatedByUser?._id ??
    conversation.supportCreatedByUserId?._id ??
    conversation.supportCreatedByUserId,
  supportCreatedByUser: conversation.supportCreatedByUser ?? null,
  assignedAdminId:
    conversation.assignedAdmin?._id ??
    conversation.assignedAdminId?._id ??
    conversation.assignedAdminId ??
    null,
  assignedAdmin: conversation.assignedAdmin ?? null,
  lastMessage: conversation.lastMessage ?? null,
  lastMessageAt: conversation.lastMessageAt ?? conversation.updatedAt,
  unreadCounts: conversation.unreadCounts ?? {},
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

/**
 * Get list of support conversations (admin)
 * GET /admin/support/conversations
 */
export const getSupportConversations = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      q,
      sort = "updatedAt-desc",
      assignedAdminId,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = { type: "support" };

    // Filter by status
    if (status && SUPPORT_STATUS_SET.includes(status)) {
      query.supportStatus = status;
    }

    // Filter by assigned admin
    if (assignedAdminId && assignedAdminId !== "unassigned") {
      query.assignedAdminId = assignedAdminId;
    } else if (assignedAdminId === "unassigned") {
      query.assignedAdminId = null;
    }

    // Search by user username/displayName
    if (q && q.trim().length > 0) {
      const users = await User.find({
        $or: [
          { userName: new RegExp(escapeRegex(q.trim()), "i") },
          { displayName: new RegExp(escapeRegex(q.trim()), "i") },
        ],
      }).select("_id");

      const userIds = users.map((u) => u._id);
      query.supportCreatedByUserId = { $in: userIds };
    }

    // Sort
    let sortObj = { updatedAt: -1 };
    if (sort === "createdAt-desc") {
      sortObj = { createdAt: -1 };
    } else if (sort === "createdAt-asc") {
      sortObj = { createdAt: 1 };
    } else if (sort === "status") {
      sortObj = { supportStatus: 1, updatedAt: -1 };
    }

    const conversations = await Conversation.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .populate("supportCreatedByUserId", "displayName userName avatarUrl email")
      .populate("assignedAdminId", "displayName userName avatarUrl")
      .populate("participants.userId", "displayName userName avatarUrl email role");

    const total = await Conversation.countDocuments(query);

    res.json({
      message: "Support conversations retrieved",
      data: {
        conversations: conversations.map(formatSupportConversation),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching support conversations:", error);
    res.status(500).json({ message: "Failed to fetch support conversations" });
  }
};

/**
 * Get support conversation detail (admin)
 * GET /admin/support/conversations/:id
 */
export const getSupportConversationDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await Conversation.findOne({
      _id: id,
      type: "support",
    });

    if (!conversation) {
      return res.status(404).json({ message: "Support conversation not found" });
    }

    await populateSupportConversation(conversation);

    // Get messages
    const messages = await Message.find({ conversationId: id })
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      message: "Support conversation retrieved",
      data: {
        conversation: formatSupportConversation(conversation),
        messages,
      },
    });
  } catch (error) {
    console.error("Error fetching support conversation detail:", error);
    res.status(500).json({ message: "Failed to fetch support conversation" });
  }
};

/**
 * Send admin reply to support
 * POST /admin/support/messages
 */
export const sendSupportReply = async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const adminId = req.user._id;

    if (!conversationId) {
      return res.status(400).json({ message: "Conversation ID is required" });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: "Message content is required" });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "support",
    });

    if (!conversation) {
      return res.status(404).json({ message: "Support conversation not found" });
    }

    // Auto-assign admin if not assigned yet
    if (!conversation.assignedAdminId) {
      conversation.assignedAdminId = adminId;
      conversation.supportStatus = "in_progress";
    }

    // Create message
    const message = new Message({
      conversationId,
      senderId: adminId,
      content: content.trim(),
      type: "user",
    });

    await message.save();

    // Update conversation
    conversation.lastMessageAt = new Date();
    conversation.lastMessage = {
      _id: message._id.toString(),
      content: message.content,
      senderId: message.senderId,
      senderDeleted: false,
      senderDisplayName: req.user.displayName,
      senderAvatar: req.user.avatarUrl,
      createdAt: message.createdAt,
    };

    // Reset unread for sender, increment for others
    const unreadCounts = new Map(conversation.unreadCounts || {});
    unreadCounts.set(adminId.toString(), 0);

    conversation.participants.forEach((participant) => {
      if (participant.userId.toString() !== adminId.toString()) {
        const key = participant.userId.toString();
        unreadCounts.set(key, (unreadCounts.get(key) || 0) + 1);
      }
    });

    conversation.unreadCounts = unreadCounts;
    await conversation.save();
    await populateSupportConversation(conversation);
    const formattedConversation = formatSupportConversation(conversation);
    const socketConversationPayload = buildSupportConversationSocketPayload(
      formattedConversation,
    );

    // Emit real-time event
    const io = getIo();
    const socketMessagePayload = {
      _id: message._id,
      conversationId,
      senderId: adminId,
      senderDisplayName: req.user.displayName,
      senderAvatar: req.user.avatarUrl,
      content: message.content,
      createdAt: message.createdAt,
      type: "user",
    };

    io.emit("new-support-message", {
      conversationId,
      message: socketMessagePayload,
      conversation: socketConversationPayload,
      unreadCounts: Object.fromEntries(unreadCounts),
      supportStatus: conversation.supportStatus,
    });

    const requesterUserId =
      formattedConversation.supportCreatedByUser?._id ??
      formattedConversation.supportCreatedByUserId;

    if (requesterUserId) {
      emitToUser(requesterUserId, "new-message", {
        message: socketMessagePayload,
        conversation: socketConversationPayload,
        unreadCounts: Object.fromEntries(unreadCounts),
      });
    }

    res.status(201).json({
      message: "Support reply sent",
      data: {
        message,
        conversation: formattedConversation,
      },
    });
  } catch (error) {
    console.error("Error sending support reply:", error);
    res.status(500).json({ message: "Failed to send reply" });
  }
};

/**
 * Update support conversation status
 * PATCH /admin/support/conversations/:id/status
 */
export const updateSupportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user._id;

    if (!status || !SUPPORT_STATUS_SET.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const conversation = await Conversation.findOne({
      _id: id,
      type: "support",
    });

    if (!conversation) {
      return res.status(404).json({ message: "Support conversation not found" });
    }

    // Auto-assign admin if not assigned and status is being changed
    if (!conversation.assignedAdminId && status !== "open") {
      conversation.assignedAdminId = adminId;
    }

    conversation.supportStatus = status;
    conversation.lastMessageAt = new Date();
    await conversation.save();
    await populateSupportConversation(conversation);
    const formattedConversation = formatSupportConversation(conversation);

    // Emit real-time event
    const io = getIo();
    io.emit("support-status-updated", {
      conversationId: id,
      status: status,
      assignedAdminId: formattedConversation.assignedAdmin?._id ?? formattedConversation.assignedAdminId,
      conversation: formattedConversation,
      timestamp: new Date(),
    });

    res.json({
      message: "Support status updated",
      data: { conversation: formattedConversation },
    });
  } catch (error) {
    console.error("Error updating support status:", error);
    res.status(500).json({ message: "Failed to update support status" });
  }
};

/**
 * Assign admin to support conversation
 * PATCH /admin/support/conversations/:id/assign
 */
export const assignSupportAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({ message: "Admin ID is required" });
    }

    const conversation = await Conversation.findOne({
      _id: id,
      type: "support",
    });

    if (!conversation) {
      return res.status(404).json({ message: "Support conversation not found" });
    }

    // Verify admin exists
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(400).json({ message: "Invalid admin ID" });
    }

    conversation.assignedAdminId = adminId;
    if (conversation.supportStatus === "open") {
      conversation.supportStatus = "in_progress";
    }
    await conversation.save();
    await populateSupportConversation(conversation);
    const formattedConversation = formatSupportConversation(conversation);

    // Emit real-time event
    const io = getIo();
    io.emit("support-assigned", {
      conversationId: id,
      assignedAdminId: adminId,
      adminName: admin.displayName,
      conversation: formattedConversation,
      timestamp: new Date(),
    });

    res.json({
      message: "Admin assigned",
      data: { conversation: formattedConversation },
    });
  } catch (error) {
    console.error("Error assigning support admin:", error);
    res.status(500).json({ message: "Failed to assign admin" });
  }
};
