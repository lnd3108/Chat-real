import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { emitToUser } from "../socket/index.js";
import { emitSupportConversationRealtime } from "../services/supportRealtimeService.js";

const SUPPORT_STATUS_OPEN_SET = ["open", "in_progress"];

const populateSupportConversation = async (conversation) => {
  await conversation.populate([
    {
      path: "participants.userId",
      select: "displayName userName avatarUrl role email",
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
    userName: participant.userId?.userName ?? null,
    displayName: participant.userId?.displayName ?? null,
    avatarUrl: participant.userId?.avatarUrl ?? null,
    role: participant.userId?.role ?? null,
    email: participant.userId?.email ?? null,
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

const buildSocketConversationPayload = (conversation) => ({
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
 * Get or create current support conversation for user
 * POST /support/conversations
 */
export const getOrCreateSupportConversation = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if user already has an open support conversation
    let supportConversation = await Conversation.findOne({
      type: "support",
      supportCreatedByUserId: userId,
      supportStatus: { $in: SUPPORT_STATUS_OPEN_SET },
    });

    // If no open conversation, create a new one
    if (!supportConversation) {
      const admin = await User.findOne({ role: "admin" }).select("_id");

      if (!admin) {
        return res.status(400).json({
          message: "No admin available. Please try again later.",
        });
      }

      supportConversation = new Conversation({
        type: "support",
        supportStatus: "open",
        supportCreatedByUserId: userId,
        participants: [
          { userId: userId, joinedAt: new Date() },
          { userId: admin._id, joinedAt: new Date() },
        ],
        unreadCounts: {
          [userId.toString()]: 0,
          [admin._id.toString()]: 1,
        },
      });

      await supportConversation.save();
      await populateSupportConversation(supportConversation);
      const formattedConversation = formatSupportConversation(supportConversation);

      await emitSupportConversationRealtime({
        type: "new-conversation",
        conversation: formattedConversation,
        actor: req.user,
      });

      return res.json({
        message: "Support conversation retrieved",
        data: { conversation: formattedConversation },
      });
    }

    await populateSupportConversation(supportConversation);
    const formattedConversation = formatSupportConversation(supportConversation);

    res.json({
      message: "Support conversation retrieved",
      data: { conversation: formattedConversation },
    });
  } catch (error) {
    console.error("Error getting/creating support conversation:", error);
    res.status(500).json({ message: "Failed to get support conversation" });
  }
};

export const getCurrentSupportConversation = getOrCreateSupportConversation;

/**
 * Get all support conversations for user (excludes deleted ones)
 * GET /support/conversations/me
 */
export const getUserSupportConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, sort = "updatedAt-desc" } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    let sortObj = { updatedAt: -1 };
    if (sort === "createdAt-desc") {
      sortObj = { createdAt: -1 };
    } else if (sort === "createdAt-asc") {
      sortObj = { createdAt: 1 };
    }

    const conversations = await Conversation.find({
      type: "support",
      supportCreatedByUserId: userId,
      userDeletedAt: null,
    })
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .populate("participants.userId", "displayName userName avatarUrl role email")
      .populate("supportCreatedByUserId", "displayName userName avatarUrl email role")
      .populate("assignedAdminId", "displayName userName avatarUrl email role");

    const total = await Conversation.countDocuments({
      type: "support",
      supportCreatedByUserId: userId,
      userDeletedAt: null,
    });

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
    console.error("Error fetching user support conversations:", error);
    res.status(500).json({ message: "Failed to fetch support conversations" });
  }
};

/**
 * Send a message in support conversation
 * POST /support/messages
 */
export const sendSupportMessage = async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const userId = req.user._id;

    if (!conversationId) {
      return res.status(400).json({ message: "Conversation ID is required" });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: "Message content is required" });
    }

    // Verify user has access to this support conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "support",
      supportCreatedByUserId: userId,
    });

    if (!conversation) {
      return res.status(403).json({
        message: "You don't have access to this support conversation",
      });
    }

    // If conversation was resolved/closed and user sends new message, reopen it
    if (conversation.supportStatus === "resolved" || conversation.supportStatus === "closed") {
      conversation.supportStatus = "open";
      conversation.lastMessageAt = new Date();
    }

    // Create message
    const message = new Message({
      conversationId,
      senderId: userId,
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
    unreadCounts.set(userId.toString(), 0);

    conversation.participants.forEach((participant) => {
      if (participant.userId.toString() !== userId.toString()) {
        const key = participant.userId.toString();
        unreadCounts.set(key, (unreadCounts.get(key) || 0) + 1);
      }
    });

    conversation.unreadCounts = unreadCounts;
    await conversation.save();
    await populateSupportConversation(conversation);
    const formattedConversation = formatSupportConversation(conversation);
    const socketConversationPayload = buildSocketConversationPayload(formattedConversation);

    const socketMessagePayload = {
      _id: message._id,
      conversationId,
      senderId: userId,
      senderDisplayName: req.user.displayName,
      senderAvatar: req.user.avatarUrl,
      content: message.content,
      createdAt: message.createdAt,
      type: "user",
    };

    await emitSupportConversationRealtime({
      type: "user-message",
      conversation: {
        ...socketConversationPayload,
        unreadCounts: Object.fromEntries(unreadCounts),
      },
      message: socketMessagePayload,
      actor: req.user,
    });

    emitToUser(userId, "new-message", {
      message: socketMessagePayload,
      conversation: socketConversationPayload,
      unreadCounts: Object.fromEntries(unreadCounts),
    });

    res.status(201).json({
      message: "Support message sent",
      data: {
        message,
        conversation: formattedConversation,
      },
    });
  } catch (error) {
    console.error("Error sending support message:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};

/**
 * Get support conversation detail with messages
 * GET /support/conversations/:id
 */
export const getSupportConversationDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: id,
      type: "support",
      supportCreatedByUserId: userId,
    });

    if (!conversation) {
      return res.status(404).json({ message: "Support conversation not found" });
    }

    await populateSupportConversation(conversation);

    // Get messages
    const messages = await Message.find({ conversationId: id })
      .sort({ createdAt: 1 })
      .lean();

    // Mark as read
    const unreadCounts = new Map(conversation.unreadCounts || {});
    unreadCounts.set(userId.toString(), 0);
    conversation.unreadCounts = unreadCounts;
    await conversation.save();

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
 * Delete support conversation for user (soft delete - saves history for admin)
 * DELETE /support/conversations/:id
 */
export const deleteSupportConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: id,
      type: "support",
      supportCreatedByUserId: userId,
    });

    if (!conversation) {
      return res.status(404).json({ message: "Support conversation not found" });
    }

    // Mark as deleted by user (soft delete - keeps history for admin)
    conversation.userDeletedAt = new Date();
    await conversation.save();

    res.json({
      message: "Support conversation deleted successfully",
      data: { conversationId: id },
    });
  } catch (error) {
    console.error("Error deleting support conversation:", error);
    res.status(500).json({ message: "Failed to delete support conversation" });
  }
};
