import Report from "../models/Report.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";

/**
 * Create a new report
 * POST /reports
 */
export const createReport = async (req, res) => {
  try {
    const { targetType, targetUserId, targetMessageId, targetConversationId, reason, description } =
      req.body;
    const reporterId = req.user._id;

    // Validation
    if (!targetType || !["user", "message", "conversation"].includes(targetType)) {
      return res.status(400).json({ message: "Invalid targetType" });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ message: "Reason is required" });
    }

    if (reason.trim().length > 500) {
      return res.status(400).json({ message: "Reason must be less than 500 characters" });
    }

    if (description && description.length > 2000) {
      return res.status(400).json({ message: "Description must be less than 2000 characters" });
    }

    // Validate target based on type
    if (targetType === "user") {
      if (!targetUserId) {
        return res.status(400).json({ message: "targetUserId is required for user reports" });
      }
      if (reporterId.toString() === targetUserId.toString()) {
        return res.status(400).json({ message: "Cannot report yourself" });
      }

      const targetUser = await User.findById(targetUserId).lean();
      if (!targetUser) {
        return res.status(404).json({ message: "Target user not found" });
      }
    }

    if (targetType === "message") {
      if (!targetMessageId) {
        return res.status(400).json({ message: "targetMessageId is required for message reports" });
      }

      const message = await Message.findById(targetMessageId).lean();
      if (!message) {
        return res.status(404).json({ message: "Target message not found" });
      }
    }

    if (targetType === "conversation") {
      if (!targetConversationId) {
        return res.status(400).json({ message: "targetConversationId is required for conversation reports" });
      }

      const conversation = await Conversation.findById(targetConversationId).lean();
      if (!conversation) {
        return res.status(404).json({ message: "Target conversation not found" });
      }
    }

    // Get snapshots
    const reporterSnapshot = {
      _id: req.user._id,
      displayName: req.user.displayName,
      userName: req.user.userName,
      avatarUrl: req.user.avatarUrl,
    };

    let targetUserSnapshot = null;
    if (targetType === "user" && targetUserId) {
      const targetUser = await User.findById(targetUserId).lean();
      if (targetUser) {
        targetUserSnapshot = {
          _id: targetUser._id,
          displayName: targetUser.displayName,
          userName: targetUser.userName,
          email: targetUser.email,
          avatarUrl: targetUser.avatarUrl,
        };
      }
    }

    let targetMessagePreview = null;
    if (targetType === "message" && targetMessageId) {
      const message = await Message.findById(targetMessageId)
        .select("content imgUrl senderId senderDisplayName senderDeleted createdAt")
        .lean();
      if (message) {
        targetMessagePreview = {
          _id: message._id,
          content: message.content,
          imgUrl: message.imgUrl,
          senderDisplayName: message.senderDisplayName,
          senderUserName: message.senderUserName,
          createdAt: message.createdAt,
        };
      }
    }

    let targetConversationSnapshot = null;
    if (targetType === "conversation" && targetConversationId) {
      const conversation = await Conversation.findById(targetConversationId)
        .select("type groupName members createdAt")
        .lean();
      if (conversation) {
        targetConversationSnapshot = {
          _id: conversation._id,
          type: conversation.type,
          groupName: conversation.groupName,
          membersCount: conversation.members ? conversation.members.length : 0,
        };
      }
    }

    // Create report
    const report = new Report({
      reporterId,
      targetType,
      targetUserId: targetType === "user" ? targetUserId : null,
      targetMessageId: targetType === "message" ? targetMessageId : null,
      targetConversationId: targetType === "conversation" ? targetConversationId : null,
      reason: reason.trim(),
      description: description ? description.trim() : null,
      reporterSnapshot,
      targetUserSnapshot,
      targetMessagePreview,
      targetConversationSnapshot,
    });

    await report.save();

    res.status(201).json({
      message: "Report created successfully",
      data: { report },
    });
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({ message: "Failed to create report" });
  }
};

/**
 * Get user's own reports
 * GET /reports/me
 */
export const getMyReports = async (req, res) => {
  try {
    const reporterId = req.user._id;
    const { page = 1, limit = 20, status, targetType } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = { reporterId };

    if (status && ["pending", "reviewing", "resolved", "rejected"].includes(status)) {
      query.status = status;
    }

    if (targetType && ["user", "message", "conversation"].includes(targetType)) {
      query.targetType = targetType;
    }

    const reports = await Report.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Report.countDocuments(query);

    res.json({
      message: "Reports retrieved successfully",
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
    console.error("Error fetching user reports:", error);
    res.status(500).json({ message: "Failed to fetch reports" });
  }
};
