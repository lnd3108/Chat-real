import Friend from "../models/Friend.js";
import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import {
  deleteImageFromCloudinary,
  deleteImageFromCloudinaryUrl,
} from "../middlewares/uploadMiddleWare.js";
import { getIo } from "../socket/index.js";
import { findDirectConversationBetweenUsers } from "../utils/blocking.js";

const toSortedFriendPair = (firstUserId, secondUserId) => {
  let userA = firstUserId.toString();
  let userB = secondUserId.toString();

  if (userA > userB) {
    [userA, userB] = [userB, userA];
  }

  return { userA, userB };
};

const mapBasicUser = (user) => ({
  _id: user?._id,
  userName: user?.userName,
  displayName: user?.displayName,
  avatarUrl: user?.avatarUrl,
});

const toFriendRequestSocketPayload = ({ request, fromUser, toUser }) => ({
  _id: request._id,
  from: mapBasicUser(fromUser),
  to: mapBasicUser(toUser),
  message: request.message,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
});

export const sendFriendRequest = async (req, res) => {
  try {
    const { to, message } = req.body;
    const from = req.user._id;
    const io = getIo();

    if (from.toString() === to?.toString()) {
      return res
        .status(400)
        .json({ message: "Không thể gửi lời mời kết bạn cho chính mình" });
    }

    const userExists = await User.exists({ _id: to });
    if (!userExists) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const { userA, userB } = toSortedFriendPair(from, to);

    const [alreadyFriends, existingRequest] = await Promise.all([
      Friend.findOne({ userA, userB }),
      FriendRequest.findOne({
        $or: [
          { from, to },
          { from: to, to: from },
        ],
      }),
    ]);

    if (alreadyFriends) {
      return res.status(400).json({ message: "Hai người đã là bạn bè" });
    }

    if (existingRequest) {
      const isReverseRequest =
        existingRequest.from.toString() === to.toString() &&
        existingRequest.to.toString() === from.toString();

      if (isReverseRequest) {
        await Friend.create({ userA: from, userB: to });
        await FriendRequest.findByIdAndDelete(existingRequest._id);

        const [fromUser, toUser] = await Promise.all([
          User.findById(from).select("_id userName displayName avatarUrl").lean(),
          User.findById(to).select("_id userName displayName avatarUrl").lean(),
        ]);
        const acceptancePayload = {
          requestId: existingRequest._id.toString(),
          userA: mapBasicUser(fromUser),
          userB: mapBasicUser(toUser),
        };

        io.to(from.toString()).emit("friend:request:accepted", acceptancePayload);
        io.to(to.toString()).emit("friend:request:accepted", acceptancePayload);

        return res.status(200).json({
          message: "Hai bạn đã tự động trở thành bạn bè",
          autoAccepted: true,
          matchedRequestId: existingRequest._id,
          newFriend: mapBasicUser(toUser),
        });
      }

      return res.status(400).json({ message: "Đã có lời mời kết bạn đang chờ" });
    }

    const request = await FriendRequest.create({ from, to, message });
    const [fromUser, toUser] = await Promise.all([
      User.findById(from).select("_id userName displayName avatarUrl").lean(),
      User.findById(to).select("_id userName displayName avatarUrl").lean(),
    ]);
    const requestPayload = toFriendRequestSocketPayload({
      request,
      fromUser,
      toUser,
    });

    io.to(to.toString()).emit("friend:request:received", { request: requestPayload });
    io.to(from.toString()).emit("friend:request:sent", { request: requestPayload });

    return res.status(201).json({
      message: "Gửi lời mời kết bạn thành công",
      autoAccepted: false,
      request: requestPayload,
    });
  } catch (error) {
    console.error("Lỗi khi gửi yêu cầu kết bạn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const acceptFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;
    const io = getIo();

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Không tìm thấy lời mời kết bạn" });
    }

    if (request.to.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "Bạn không có quyền chấp nhận lời mời kết bạn này",
      });
    }

    const { userA, userB } = toSortedFriendPair(request.from, request.to);
    const existingFriend = await Friend.findOne({ userA, userB });

    if (!existingFriend) {
      await Friend.create({
        userA: request.from,
        userB: request.to,
      });
    }

    await FriendRequest.findByIdAndDelete(requestId);

    const [fromUser, toUser] = await Promise.all([
      User.findById(request.from).select("_id userName displayName avatarUrl").lean(),
      User.findById(request.to).select("_id userName displayName avatarUrl").lean(),
    ]);
    const acceptancePayload = {
      requestId: requestId.toString(),
      userA: mapBasicUser(fromUser),
      userB: mapBasicUser(toUser),
    };

    io.to(request.from.toString()).emit("friend:request:accepted", acceptancePayload);
    io.to(request.to.toString()).emit("friend:request:accepted", acceptancePayload);

    return res.status(200).json({
      message: "Chấp nhận lời mời thành công",
      newFriend: mapBasicUser(fromUser),
    });
  } catch (error) {
    console.error("Lỗi khi chấp nhận yêu cầu kết bạn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const declineFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;
    const io = getIo();

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Không tìm thấy lời mời kết bạn" });
    }

    if (request.to.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "Bạn không có quyền từ chối lời mời kết bạn này",
      });
    }

    await FriendRequest.findByIdAndDelete(requestId);
    io.to(request.from.toString()).emit("friend:request:removed", {
      requestId: requestId.toString(),
      fromUserId: request.from.toString(),
      toUserId: request.to.toString(),
      reason: "declined",
    });
    io.to(request.to.toString()).emit("friend:request:removed", {
      requestId: requestId.toString(),
      fromUserId: request.from.toString(),
      toUserId: request.to.toString(),
      reason: "declined",
    });
    return res.sendStatus(204);
  } catch (error) {
    console.error("Lỗi khi từ chối yêu cầu kết bạn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const cancelSentFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Không tìm thấy lời mời kết bạn" });
    }

    if (request.from.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "Bạn không có quyền hủy lời mời kết bạn này",
      });
    }

    await FriendRequest.findByIdAndDelete(requestId);
    return res.status(200).json({ message: "Đã hủy lời mời kết bạn" });
  } catch (error) {
    console.error("Lỗi khi hủy yêu cầu kết bạn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getAllFriends = async (req, res) => {
  try {
    const userId = req.user._id;

    const friendships = await Friend.find({
      $or: [{ userA: userId }, { userB: userId }],
    })
      .populate("userA", "_id displayName avatarUrl userName")
      .populate("userB", "_id displayName avatarUrl userName")
      .lean();

    if (!friendships.length) {
      return res.status(200).json({ friends: [] });
    }

    const friends = friendships
      .map((friendship) => {
        if (!friendship.userA || !friendship.userB) return null;

        return friendship.userA._id.toString() === userId.toString()
          ? friendship.userB
          : friendship.userA;
      })
      .filter(Boolean);

    return res.status(200).json({ friends });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bạn bè", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getFriendRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const populateFields = "_id userName displayName avatarUrl";

    const [sent, received] = await Promise.all([
      FriendRequest.find({ from: userId }).populate("to", populateFields),
      FriendRequest.find({ to: userId }).populate("from", populateFields),
    ]);

    return res.status(200).json({ sent, received });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách yêu cầu kết bạn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const removeFriend = async (req, res) => {
  try {
    const userId = req.user._id;
    const { targetUserId } = req.params;
    const io = getIo();

    if (userId.toString() === targetUserId.toString()) {
      return res.status(400).json({ message: "Không thể hủy kết bạn với chính mình" });
    }

    const targetUser = await User.findById(targetUserId).select("_id");
    if (!targetUser) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const { userA, userB } = toSortedFriendPair(userId, targetUserId);
    const friendship = await Friend.findOneAndDelete({ userA, userB });

    if (!friendship) {
      return res.status(404).json({ message: "Hai người hiện không còn là bạn bè" });
    }

    await FriendRequest.deleteMany({
      $or: [
        { from: userId, to: targetUserId },
        { from: targetUserId, to: userId },
      ],
    });

    const directConversation = await findDirectConversationBetweenUsers(userId, targetUserId);
    let conversationId = null;

    if (directConversation?._id) {
      conversationId = directConversation._id.toString();

      const messagesWithImages = await Message.find({
        conversationId: directConversation._id,
        $or: [{ imgPublicId: { $ne: null } }, { imgUrl: { $ne: null } }],
      }).select("imgPublicId imgUrl");

      await Promise.all(
        messagesWithImages.map(async (message) => {
          if (message.imgPublicId) {
            await deleteImageFromCloudinary(message.imgPublicId).catch((error) => {
              console.error("KhÃ´ng thá»ƒ xÃ³a áº£nh tin nháº¯n trÃªn Cloudinary:", error);
            });
            return;
          }

          if (message.imgUrl) {
            await deleteImageFromCloudinaryUrl(message.imgUrl).catch((error) => {
              console.error("KhÃ´ng thá»ƒ xÃ³a áº£nh tin nháº¯n trÃªn Cloudinary:", error);
            });
          }
        }),
      );

      await Message.deleteMany({ conversationId: directConversation._id });
      await Conversation.deleteOne({ _id: directConversation._id });

      io.to(userId.toString()).emit("conversation:deleted", { conversationId });
      io.to(targetUserId.toString()).emit("conversation:deleted", { conversationId });
      io.to(conversationId).emit("conversation:deleted", { conversationId });
    }

    const removalPayload = {
      userId: userId.toString(),
      targetUserId: targetUserId.toString(),
      conversationId,
      clearedDirectChat: Boolean(conversationId),
    };

    io.to(userId.toString()).emit("friend:removed", removalPayload);
    io.to(targetUserId.toString()).emit("friend:removed", removalPayload);

    return res.status(200).json({
      message: "Đã hủy kết bạn thành công",
      conversationId,
      clearedDirectChat: Boolean(conversationId),
    });
  } catch (error) {
    console.error("Lỗi khi hủy kết bạn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
