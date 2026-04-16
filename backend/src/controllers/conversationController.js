import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { uploadImageFromBuffer } from "../middlewares/uploadMiddleWare.js";
import { getIo } from "../socket/index.js";
import {
  emitNewMessage,
  updateConversationAfterCreateMessage,
} from "../utils/messageHelper.js";

const createSystemMessage = async (conversation, actorId, content) => {
  const message = await Message.create({
    conversationId: conversation._id,
    senderId: actorId,
    type: "system",
    content,
  });

  updateConversationAfterCreateMessage(conversation, message, actorId);
  await conversation.save();

  return message;
};

const populateConversationForClient = async (conversation) => {
  await conversation.populate([
    { path: "participants.userId", select: "displayName avatarUrl" },
    { path: "seenBy", select: "displayName avatarUrl" },
    { path: "lastMessage.senderId", select: "displayName avatarUrl" },
  ]);

  return conversation;
};

const formatConversationForClient = (conversation) => {
  const participants = (conversation.participants || []).map((p) => ({
    _id: p.userId?._id,
    displayName: p.userId?.displayName,
    avatarUrl: p.userId?.avatarUrl ?? null,
    joinedAt: p.joinedAt,
  }));

  return {
    ...conversation.toObject(),
    unreadCounts: conversation.unreadCounts || {},
    participants,
  };
};

const getClearedAtForUser = (conversation, userId) => {
  const currentUserId = userId?.toString();
  if (!currentUserId) return null;

  const clearedEntry = (conversation.clearedFor || []).find(
    (item) => item.userId?.toString() === currentUserId,
  );

  return clearedEntry?.clearedAt ? new Date(clearedEntry.clearedAt) : null;
};

const normalizeMessageForUser = (message, userId) => {
  const currentUserId = userId?.toString();
  return {
    ...message.toObject(),
    deletedFor: (message.deletedFor || []).map((item) => item.toString()),
    reactions: (message.reactions || []).map((reaction) => ({
      emoji: reaction.emoji,
      userIds: (reaction.userIds || []).map((item) => item.toString()),
    })),
    isHiddenForMe: (message.deletedFor || []).some(
      (item) => item.toString() === currentUserId,
    ),
  };
};

const shouldIncludeConversationForUser = (conversation, userId) => {
  if (conversation.type !== "direct") return true;

  const clearedAt = getClearedAtForUser(conversation, userId);
  if (!clearedAt) return true;

  if (!conversation.lastMessageAt) return false;

  return new Date(conversation.lastMessageAt) > clearedAt;
};

// Tạo cuộc trò chuyện mới, nếu đã tồn tại cuộc trò chuyện 1-1 thì trả về cuộc trò chuyện đó, nếu là nhóm thì tạo mới
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
          avatarUrl: null,
          avatarId: null,
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

    await populateConversationForClient(conversation);

    const formatted = formatConversationForClient(conversation);

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

// Lấy danh sách cuộc trò chuyện mà user đang tham gia, sắp xếp theo lastMessageAt giảm dần
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

    const formatted = conversations
      .filter((convo) => shouldIncludeConversationForUser(convo, userId))
      .map((convo) => {
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

// Lấy tin nhắn trong cuộc trò chuyện với phân trang cursor-based
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, cursor } = req.query;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId).select(
      "_id participants clearedFor",
    );

    if(!conversation){
      return res.status(404).json({
        message: "Conversation không tồn tại",
      })
    }

    const isMember = conversation.participants.some(
      (p) => p.userId.toString() === userId.toString(),
    );


    if(!isMember){
      return res.status(403).json({
        message: "Bạn không thuộc cuộc trò chuyện này",
      })
    }

    const query = {
      conversationId,
      deletedFor: { $ne: userId },
    };
    const clearedAt = getClearedAtForUser(conversation, userId);

    if (clearedAt) {
      query.createdAt = { $gt: clearedAt };
    }

    if (typeof cursor === "string" && cursor.trim() !== "") {
      const d = new Date(cursor);

      if (!Number.isNaN(d.getTime())) {
        query.createdAt = {
          ...(query.createdAt || {}),
          $lt: d,
        };
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

    return res.status(200).json({
      messages: messages.map((message) => normalizeMessageForUser(message, userId)),
      nextCursor,
    });
  } catch (error) {
    console.error("Lỗi xảy ra khi lấy messages", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Lấy danh sách conversationId mà user đang tham gia để join room trong Socket.IO
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

// Đánh dấu cuộc trò chuyện đã xem, reset unread count về 0 và thêm user vào seenBy
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

// Chỉ chủ nhóm mới có thể xóa nhóm, thành viên bình thường chỉ có thể rời nhóm
export const deleteOrLeaveGroupConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();
    const userObjectId = req.user._id;
    const io = getIo();

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation không tồn tại" });
    }

    if (conversation.type !== "group" && conversation.type !== "direct") {
      return res.status(400).json({ message: "Chỉ áp dụng cho nhóm (group)" });
    }

    const isMember = conversation.participants?.some(
      (p) => p.userId.toString() === userId,
    );
    if (!isMember) {
      return res
        .status(403)
        .json({ message: "Bạn không thuộc cuộc trò chuyện này" });
    }

    if (conversation.type === "direct") {
      const clearedAt = new Date();

      await Conversation.findByIdAndUpdate(conversationId, {
        $pull: {
          clearedFor: { userId: userObjectId },
          seenBy: userObjectId,
        },
        $set: { [`unreadCounts.${userId}`]: 0 },
      });

      await Conversation.findByIdAndUpdate(conversationId, {
        $push: {
          clearedFor: {
            userId: userObjectId,
            clearedAt,
          },
        },
      });

      io.to(userId).emit("conversation:direct-cleared", { conversationId });

      return res.status(200).json({
        message: "ÄÃ£ xÃ³a lá»‹ch sá»­ chat á»Ÿ phÃ­a báº¡n",
        deleted: false,
        cleared: true,
      });
    }

    const ownerId = conversation.group?.createdBy?.toString();
    const isOwner = ownerId && ownerId === userId;

    if (isOwner) {
      // Lấy danh sách member để emit trước khi xóa
      const memberIds = conversation.participants.map((p) =>
        p.userId.toString(),
      );
      await Message.deleteMany({ conversationId }); // xóa tất cả tin nhắn
      await Conversation.deleteOne({ _id: conversationId });

      // Emit cho từng user để họ remove conversation khỏi UI
      memberIds.forEach((uid) => {
        io.to(uid).emit("conversation:deleted", { conversationId });
      });

      // Emit vào room để các tab đang join room biết (optional)
      io.to(conversationId).emit("conversation:deleted", { conversationId });

      return res
        .status(200)
        .json({ message: "Đã xóa nhóm thành công", deleted: true });
    }

    const updated = await Conversation.findByIdAndUpdate(
      conversationId,
      {
        $pull: {
          participants: { userId: userObjectId },
          seenBy: userObjectId,
        },
        $unset: { [`unreadCounts.${userId}`]: "" },
      },
      { new: true },
    );

    if (updated) {
      const systemMessage = await createSystemMessage(
        updated,
        userObjectId,
        `${req.user.displayName || "Một thành viên"} đã rời nhóm`,
      );
      emitNewMessage(io, updated, systemMessage);
    }

    // Emit cho chính user đó để UI remove conversation khỏi list
    io.to(userId).emit("conversation:left", {
      conversationId,
      userId,
      groupName: conversation.group?.name ?? "Nhóm",
      removedByOther: false,
    });

    // Emit cho các member còn lại biết có người rời (optional)
    io.to(conversationId).emit("conversation:member-left", {
      conversationId,
      userId,
      participantsCount: updated?.participants?.length ?? 0,
    });

    return res.status(200).json({
      message: "Bạn đã rời nhóm và cuộc trò chuyện đã được xóa ở phía bạn",
      deleted: false,
      left: true,
    });
  } catch (error) {
    console.error("Lỗi deleteOrLeaveGroupConversation:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Chỉ chủ nhóm mới có thể thêm thành viên mới vào nhóm
export const addGroupMembers = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { memberIds } = req.body;
    const userId = req.user._id.toString();
    const io = getIo();

    // Validate input
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res
        .status(400)
        .json({ message: "memberIds phải là array không rỗng" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation || conversation.type !== "group") {
      return res
        .status(404)
        .json({
          message: "Cuộc trò chuyện không tồn tại hoặc không phải nhóm",
        });
    }

    const isOwner =
      conversation.group?.createdBy?.toString() === userId.toString();
    if (!isOwner) {
      return res
        .status(403)
        .json({ message: "Chỉ chủ nhóm mới có thể thêm thành viên" });
    }

    const existing = new Set(
      conversation.participants.map((p) => p.userId.toString()),
    );

    const newMemberIds = memberIds.filter((id) => !existing.has(id.toString()));

    if (newMemberIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Tất cả thành viên đã có trong nhóm" });
    }

    const newParticipants = newMemberIds.map((id) => ({
      userId: id,
      joinedAt: new Date(),
    }));

    const updated = await Conversation.findByIdAndUpdate(
      conversationId,
      {
        $push: { participants: { $each: newParticipants } },
      },
      { new: true },
    );

    const addedUsers = await User.find({
      _id: { $in: newMemberIds },
    }).select("displayName");

    for (const addedUser of addedUsers) {
      const systemMessage = await createSystemMessage(
        updated,
        req.user._id,
        `${addedUser.displayName || "Một thành viên"} vừa tham gia cuộc hội thoại`,
      );
      emitNewMessage(io, updated, systemMessage);
    }

    const populatedConversation = await Conversation.findById(conversationId).populate([
      { path: "participants.userId", select: "displayName avatarUrl" },
      { path: "group.createdBy", select: "displayName avatarUrl" },
    ]);

    if (!populatedConversation) {
      return res.status(404).json({ message: "Cuộc trò chuyện không tồn tại" });
    }

    // Emit cho các thành viên mới được thêm vào để họ join room và cập nhật UI
    io.to(conversationId).emit("conversation:members-added", {
      conversationId,
      newMembers: newMemberIds,
      participants: formatConversationForClient(populatedConversation).participants,
    });

    newMemberIds.forEach((memberId) => {
      io.to(memberId).emit("new-group", formatConversationForClient(populatedConversation));
      io.to(memberId).emit("added-to-group", {
        groupId: conversationId,
        groupName: populatedConversation.group.name,
      });
    });

    return res
      .status(200)
      .json({
        message: "Thêm thành viên thành công",
        conversation: populatedConversation,
      });
  } catch (error) {
    console.error("Lỗi addGroupMembers:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Chỉ chủ nhóm mới có thể xóa thành viên khỏi nhóm, thành viên bình thường không có quyền này
export const removeGroupMember = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { memberId } = req.body;
    const userId = req.user._id.toString();
    const io = getIo();

    if (!memberId) {
      return res.status(400).json({ message: "memberId là bắt buộc" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation || conversation.type !== "group") {
      return res
        .status(404)
        .json({
          message: "Cuộc trò chuyện không tồn tại hoặc không phải nhóm",
        });
    }

    // Kiểm tra xem user có phải là chủ nhóm không
    const isOwner =
      conversation.group?.createdBy?.toString() === userId.toString();
    const isSelf = userId.toString() === memberId.toString();

    if (!isOwner && !isSelf) {
      return res
        .status(403)
        .json({
          message:
            "Chỉ chủ nhóm mới có thể xóa thành viên khác, bạn chỉ có thể rời nhóm",
        });
    }

    // Kiểm tra xem memberId có phải là thành viên của nhóm không
    const isMember = conversation.participants?.some(
      (p) => p.userId.toString() === memberId.toString(),
    );

    // Nếu không phải thành viên nào đó trong nhóm thì không thể xóa
    if (!isMember) {
      return res
        .status(404)
        .json({ message: "Thành viên không tồn tại trong nhóm" });
    }

    // Nhóm hiện chỉ có một chủ nhóm duy nhất, nên admin có thể xóa thành viên khác
    // miễn là không xóa người không tồn tại và không vi phạm quyền truy cập ở trên.
    const updated = await Conversation.findByIdAndUpdate(
      conversationId,
      {
        $pull: {
          participants: { userId: memberId },
          seenBy: memberId,
        },
        $unset: { [`unreadCounts.${memberId}`]: "" },
      },
      { new: true },
    );

    if (updated) {
      const targetUser = await User.findById(memberId).select("displayName");
      const actorName =
        req.user.displayName ||
        (isSelf ? "Một thành viên" : "Chủ nhóm");
      const targetName =
        targetUser?.displayName ||
        (isSelf ? req.user.displayName : "Một thành viên");

      const systemContent = isSelf
        ? `${actorName} đã rời nhóm`
        : `${targetName} đã bị xóa khỏi nhóm`;

      const systemMessage = await createSystemMessage(
        updated,
        req.user._id,
        systemContent,
      );
      emitNewMessage(io, updated, systemMessage);
    }

    // Emit cho thành viên bị xóa để họ rời room và cập nhật UI
    io.to(memberId).emit("conversation:left", {
      conversationId,
      userId: memberId,
      groupName: conversation.group?.name ?? "Nhóm",
      removedByOther: !isSelf,
    });

    io.to(conversationId).emit("conversation:member-removed", {
      conversationId,
      memberId,
      participantsCount: updated.participants.length,
    });

    return res.status(200).json({
      message: isSelf ? "Bạn đã rời nhóm" : "Đã xóa thành viên khỏi nhóm",
      succeeded: true,
    });
  } catch (error) {
    console.error("Lỗi removeGroupMember:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Chỉ chủ nhóm mới có thể chỉnh sửa tên nhóm và ảnh đại diện nhóm
export const uploadGroupAvatar = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "KhÃ´ng cÃ³ file Ä‘Æ°á»£c táº£i lÃªn" });
    }

    const conversation = await Conversation.findById(conversationId);

    if (!conversation || conversation.type !== "group") {
      return res.status(404).json({
        message: "Cuá»™c trÃ² chuyá»‡n khÃ´ng tá»“n táº¡i hoáº·c khÃ´ng pháº£i nhÃ³m",
      });
    }

    const isMember = conversation.participants.some(
      (participant) => participant.userId.toString() === userId,
    );

    if (!isMember) {
      return res.status(403).json({
        message: "Báº¡n khÃ´ng thuá»™c cuá»™c trÃ² chuyá»‡n nÃ y",
      });
    }

    const uploadResult = await uploadImageFromBuffer(file.buffer, {
      folder: "chat_app/group_avatars",
      transformation: [{ width: 256, height: 256, crop: "fill" }],
    });

    conversation.group.avatarUrl = uploadResult.secure_url;
    conversation.group.avatarId = uploadResult.public_id;

    await conversation.save();
    await populateConversationForClient(conversation);

    const formattedConversation = formatConversationForClient(conversation);

    getIo().to(conversationId).emit("conversation:updated", {
      conversation: formattedConversation,
    });

    return res.status(200).json({
      message: "Cáº­p nháº­t áº£nh nhÃ³m thÃ nh cÃ´ng",
      conversation: formattedConversation,
    });
  } catch (error) {
    console.error("Lá»—i uploadGroupAvatar:", error);
    return res.status(500).json({ message: "Lá»—i há»‡ thá»‘ng" });
  }
};

export const getGroupDetails = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId).populate([
      { path: "participants.userId", select: "displayName avatarUrl email" },
      { path: "group.createdBy", select: "displayName avatarUrl" },
    ]);

    if (!conversation) {
      return res.status(404).json({
        message: "Cuộc trò chuyện không tồn tại",
      });
    }

    const isMember = conversation.participants.some(
      (p) => p.userId._id.toString() === userId.toString(),
    );

    if (!isMember) {
      return res.status(403).json({
        message: "Bạn không thuộc cuộc trò chuyện này",
      });
    }

    // Kiểm tra xem user có phải là chủ nhóm không
    const isOwner =
      conversation.group?.createdBy?._id?.toString() === userId.toString();

    // Chỉ chủ nhóm mới có quyền chỉnh sửa, nhưng cả thành viên đều có thể xem chi tiết nhóm
    return res.status(200).json({
      group: {
        _id: conversation._id,
        name: conversation.group?.name,
        avatarUrl: conversation.group?.avatarUrl ?? null,
        createdBy: conversation.group?.createdBy,
        createdAt: conversation.createdAt,
        members: conversation.participants.map((p) => ({
          _id: p.userId._id,
          displayName: p.userId.displayName,
          avatarUrl: p.userId.avatarUrl,
          email: p.userId.email,
          joinedAt: p.joinedAt,
          isOwner:
            p.userId._id.toString() === conversation.group.createdBy.toString(),
        })),
        isOwner,
        memberCount: conversation.participants.length,
      },
    });
  } catch (error) {
    console.error("Lỗi getGroupDetails:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
