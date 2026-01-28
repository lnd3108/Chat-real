import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { getIo } from "../socket/index.js";

export const createConversation = async (req, res) => {
  try {
    const { type, name, memberIds } = req.body;
    const userId = req.user._id;
    const io = getIo();

    if (
      !type ||
      (type === "group" && !name) ||
      !memberIds ||
      !Array.isArray(memberIds) ||
      memberIds.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "Tên nhóm và danh sách thành viên là bắt buộc" });
    }

    let conversation;

    if (type === "direct") {
      const participantId = memberIds[0];

      conversation = await Conversation.findOne({
        type: "direct",
        "participants.userId": { $all: [userId, participantId] },
      });

      if (!conversation) {
        conversation = new Conversation({
          type: "direct",
          participants: [{ userId }, { userId: participantId }],
          lastMessageAt: new Date(),
        });

        await conversation.save();
      }
    }

    if (type === "group") {
      const meStr = userId.toString();

      const uniqueMemberIds = [
        ...new Set(memberIds.map((id) => id.toString())),
      ].filter((id) => id !== meStr);

      const participants = [
        { userId },
        ...uniqueMemberIds.map((id) => ({ userId: id })),
      ];

      conversation = new Conversation({
        type: "group",
        participants,
        group: {
          name,
          createdBy: userId,
        },
        lastMessageAt: new Date(),
      });
      await conversation.save();
    }
    if (!conversation) {
      return res
        .status(400)
        .json({ message: "Conversation type không hợp lệ" });
    }

    await conversation.populate([
      { path: "participants.userId", select: "displayName avatarUrl" },
      { path: "seenBy", select: "displayName avatarUrl" },
      { path: "lastMessage.senderId", select: "displayName avatarUrl" },
    ]);

    const participants = (conversation.participants || []).map((p) => ({
      _id: p.userId?._id,
      displayName: p.userId?.displayName,
      avatarUrl: p.userId?.avatarUrl ?? null,
      joinedAt: p.joinedAt,
    }));

    const formatted = {
      ...conversation.toObject(),
      unreadCounts: conversation.unreadCounts || {},
      participants,
      group: conversation.group
        ? {
            ...conversation.group,
            createdBy:
              conversation.group.createdBy?.toString?.() ??
              conversation.group.createdBy,
          }
        : undefined,
    };

    if (type === "group") {
      formatted.participants.forEach((p) => {
        const uid = p._id?.toString();
        if (!uid) return;

        io.to(uid).emit("new-group", formatted);
      });
    }
    return res.status(201).json({ conversation: formatted });
  } catch (error) {
    console.error("Lỗi khi tạo conversation", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
export const getConversation = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      "participants.userId": userId,
    })
      // .sort({ lastMessageAt: 1, updatedAt: -1 })
      .sort({ lastMessageAt: -1 })
      .populate({
        path: "participants.userId",
        select: "displayName avatarUrl",
      })
      .populate({
        path: "lastMessage.senderId",
        select: "displayName avatarUrl",
      })
      .populate({
        path: "seenBy",
        select: "displayName avatarUrl",
      });

    const formatted = conversations.map((convo) => {
      const participants = (convo.participants || []).map((p) => ({
        _id: p.userId?._id,
        displayName: p.userId?.displayName,
        avatarUrl: p.userId?.avatarUrl ?? null,
        joinedAt: p.joinedAt,
      }));
      return {
        ...convo.toObject(),
        unreadCounts: convo.unreadCounts || {},
        participants,
      };
    });

    return res.status(200).json({ conversations: formatted });
  } catch (error) {
    console.error("Lỗi xảy ra khi lấy conversations", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, cursor } = req.query;

    const query = { conversationId };

    if (typeof cursor === "string" && cursor.trim() !== "") {
      const d = new Date(cursor);

      if (!Number.isNaN(d.getTime())) {
        query.createdAt = { $lt: d };
      }
    }

    let messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) + 1);

    let nextCursor = null;

    if (messages.length > Number(limit)) {
      const nextMessage = messages[messages.length - 1];
      nextCursor = nextMessage.createdAt.toISOString();
      messages.pop();
    }

    messages = messages.reverse();

    return res.status(200).json({ messages, nextCursor });
  } catch (error) {
    console.error("Lỗi xảy ra khi lấy messages", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getUserConversationsForSocketIO = async (userId) => {
  try {
    const conversations = await Conversation.find(
      { "participants.userId": userId },
      {
        _id: 1,
      },
    );

    return conversations.map((c) => c._id.toString());
  } catch (error) {
    console.error("Lỗi khi fetch conversations: ", error);
    return [];
  }
};

export const markasSeen = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const userId = req.user._id.toString();

    const conversation = await Conversation.findById(conversationId).lean();

    if (!conversation) {
      return res.status(404).json({ message: "Conversation không tồn tại " });
    }

    const last = conversation.lastMessage;

    if (!last) {
      return res
        .status(200)
        .json({ message: "Không có tin nhắn đẻ mark as seen" });
    }

    if (last.senderId.toString() === userId) {
      return res.status(200).json({ message: "Sender không cần mark as seen" });
    }

    const updated = await Conversation.findByIdAndUpdate(
      conversationId,
      {
        $addToSet: { seenBy: userId },
        $set: { [`unreadCounts.${userId}`]: 0 },
      },
      {
        new: true,
      },
    );

    const io = getIo();
    io.to(conversationId).emit("read-message", {
      conversation: {
        _id: updated._id,
        unreadCounts: updated.unreadCounts,
        seenBy: updated.seenBy,
        lastMessage: updated.lastMessage,
        lastMessageAt: updated.lastMessageAt,
      },
    });

    return res.status(200).json({
      message: "marked as seen",
      seenBy: updated?.seenBy || [],
      myUnreadCount: updated?.unreadCounts[userId] || 0,
    });
  } catch (error) {
    console.error("Lỗi khi mark as seen", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();
    const io = getIo();

    //  tìm conversation
    const convo = await Conversation.findById(conversationId);
    if (!convo) {
      return res.status(404).json({ message: "Conversation không tồn tại" });
    }

    // chỉ participant mới được thao tác
    const isMember = (convo.participants || []).some(
      (p) => p.userId.toString() === userId,
    );
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền" });
    }

    // CHECK OWNER (CHÈN ĐOẠN MÀY HỎI Ở ĐÂY)
    if (convo.type === "group") {
      const ownerId = convo.group?.createdBy?.toString();
      if (!ownerId) {
        return res.status(400).json({ message: "Group missing createdBy" });
      }

      if (ownerId !== userId) {
        return res.status(403).json({
          message: "Chỉ chủ nhóm mới có quyền xóa cuộc trò chuyện này",
        });
      }
    }

    // lấy memberIds để emit realtime
    const memberIds = (convo.participants || []).map((p) =>
      p.userId.toString(),
    );

    // xóa messages
    await Message.deleteMany({ conversationId });

    //xóa conversation
    await Conversation.findByIdAndDelete(conversationId);

    // realtime: báo cho tất cả member
    memberIds.forEach((uid) => {
      io.to(uid).emit("conversation-deleted", { conversationId });
    });

    return res.status(200).json({ message: "deleted", conversationId });
  } catch (error) {
    console.error("Lỗi khi xóa conversation", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
