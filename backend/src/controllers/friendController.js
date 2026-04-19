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
  status: request.status ?? "pending",
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
        .json({ message: "KhÃ´ng thá»ƒ gá»­i lá»i má»i káº¿t báº¡n cho chÃ­nh mÃ¬nh" });
    }

    const userExists = await User.exists({ _id: to });
    if (!userExists) {
      return res.status(404).json({ message: "NgÆ°á»i dÃ¹ng khÃ´ng tá»“n táº¡i" });
    }

    const { userA, userB } = toSortedFriendPair(from, to);

    const [alreadyFriends, existingRequest] = await Promise.all([
      Friend.findOne({ userA, userB }),
      FriendRequest.findOne({
        $or: [
          { from, to },
          { from: to, to: from },
        ],
      }).sort({ updatedAt: -1 }),
    ]);

    if (alreadyFriends) {
      return res.status(400).json({ message: "Hai ngÆ°á»i Ä‘Ã£ lÃ  báº¡n bÃ¨" });
    }

    if (existingRequest) {
      const isReverseRequest =
        existingRequest.from.toString() === to.toString() &&
        existingRequest.to.toString() === from.toString();
      const isPendingRequest = (existingRequest.status ?? "pending") === "pending";

      if (isReverseRequest && isPendingRequest) {
        await Friend.create({ userA: from, userB: to });
        await FriendRequest.findByIdAndUpdate(existingRequest._id, {
          $set: { status: "accepted" },
        });

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
          message: "Hai báº¡n Ä‘Ã£ tá»± Ä‘á»™ng trá»Ÿ thÃ nh báº¡n bÃ¨",
          autoAccepted: true,
          matchedRequestId: existingRequest._id,
          newFriend: mapBasicUser(toUser),
        });
      }

      if (!isReverseRequest && isPendingRequest) {
        return res.status(400).json({ message: "ÄÃ£ cÃ³ lá»i má»i káº¿t báº¡n Ä‘ang chá»" });
      }

      if (!isReverseRequest) {
        const request = await FriendRequest.findByIdAndUpdate(
          existingRequest._id,
          {
            $set: {
              message: message ?? "",
              status: "pending",
            },
          },
          { new: true }
        );
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

        return res.status(200).json({
          message: "Gá»­i láº¡i lá»i má»i káº¿t báº¡n thÃ nh cÃ´ng",
          autoAccepted: false,
          request: requestPayload,
        });
      }
    }

    const request = await FriendRequest.create({ from, to, message, status: "pending" });
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
      message: "Gá»­i lá»i má»i káº¿t báº¡n thÃ nh cÃ´ng",
      autoAccepted: false,
      request: requestPayload,
    });
  } catch (error) {
    console.error("Lá»—i khi gá»­i yÃªu cáº§u káº¿t báº¡n", error);
    return res.status(500).json({ message: "Lá»—i há»‡ thá»‘ng" });
  }
};

export const acceptFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;
    const io = getIo();

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "KhÃ´ng tÃ¬m tháº¥y lá»i má»i káº¿t báº¡n" });
    }

    if (request.to.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "Báº¡n khÃ´ng cÃ³ quyá»n cháº¥p nháº­n lá»i má»i káº¿t báº¡n nÃ y",
      });
    }

    if ((request.status ?? "pending") !== "pending") {
      return res.status(400).json({ message: "Lá»i má»i nÃ y Ä‘Ã£ Ä‘Æ°á»£c xá»­ lÃ½" });
    }

    const { userA, userB } = toSortedFriendPair(request.from, request.to);
    const existingFriend = await Friend.findOne({ userA, userB });

    if (!existingFriend) {
      await Friend.create({
        userA: request.from,
        userB: request.to,
      });
    }

    await FriendRequest.findByIdAndUpdate(requestId, {
      $set: { status: "accepted" },
    });

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
      message: "Cháº¥p nháº­n lá»i má»i thÃ nh cÃ´ng",
      newFriend: mapBasicUser(fromUser),
    });
  } catch (error) {
    console.error("Lá»—i khi cháº¥p nháº­n yÃªu cáº§u káº¿t báº¡n", error);
    return res.status(500).json({ message: "Lá»—i há»‡ thá»‘ng" });
  }
};

export const declineFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;
    const io = getIo();

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "KhÃ´ng tÃ¬m tháº¥y lá»i má»i káº¿t báº¡n" });
    }

    if (request.to.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "Báº¡n khÃ´ng cÃ³ quyá»n tá»« chá»‘i lá»i má»i káº¿t báº¡n nÃ y",
      });
    }

    if ((request.status ?? "pending") !== "pending") {
      return res.status(400).json({ message: "Lá»i má»i nÃ y Ä‘Ã£ Ä‘Æ°á»£c xá»­ lÃ½" });
    }

    await FriendRequest.findByIdAndUpdate(requestId, {
      $set: { status: "rejected" },
    });
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
    console.error("Lá»—i khi tá»« chá»‘i yÃªu cáº§u káº¿t báº¡n", error);
    return res.status(500).json({ message: "Lá»—i há»‡ thá»‘ng" });
  }
};

export const cancelSentFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "KhÃ´ng tÃ¬m tháº¥y lá»i má»i káº¿t báº¡n" });
    }

    if (request.from.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "Báº¡n khÃ´ng cÃ³ quyá»n há»§y lá»i má»i káº¿t báº¡n nÃ y",
      });
    }

    if ((request.status ?? "pending") !== "pending") {
      return res.status(400).json({ message: "Lá»i má»i nÃ y Ä‘Ã£ Ä‘Æ°á»£c xá»­ lÃ½" });
    }

    await FriendRequest.findByIdAndUpdate(requestId, {
      $set: { status: "cancelled" },
    });
    return res.status(200).json({ message: "ÄÃ£ há»§y lá»i má»i káº¿t báº¡n" });
  } catch (error) {
    console.error("Lá»—i khi há»§y yÃªu cáº§u káº¿t báº¡n", error);
    return res.status(500).json({ message: "Lá»—i há»‡ thá»‘ng" });
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
    console.error("Lá»—i khi láº¥y danh sÃ¡ch báº¡n bÃ¨", error);
    return res.status(500).json({ message: "Lá»—i há»‡ thá»‘ng" });
  }
};

export const getFriendRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const populateFields = "_id userName displayName avatarUrl";

    const [sent, received] = await Promise.all([
      FriendRequest.find({ from: userId, status: "pending" }).populate("to", populateFields),
      FriendRequest.find({ to: userId, status: "pending" }).populate("from", populateFields),
    ]);

    return res.status(200).json({ sent, received });
  } catch (error) {
    console.error("Lá»—i khi láº¥y danh sÃ¡ch yÃªu cáº§u káº¿t báº¡n", error);
    return res.status(500).json({ message: "Lá»—i há»‡ thá»‘ng" });
  }
};

export const removeFriend = async (req, res) => {
  try {
    const userId = req.user._id;
    const { targetUserId } = req.params;
    const io = getIo();

    if (userId.toString() === targetUserId.toString()) {
      return res.status(400).json({ message: "KhÃ´ng thá»ƒ há»§y káº¿t báº¡n vá»›i chÃ­nh mÃ¬nh" });
    }

    const targetUser = await User.findById(targetUserId).select("_id");
    if (!targetUser) {
      return res.status(404).json({ message: "NgÆ°á»i dÃ¹ng khÃ´ng tá»“n táº¡i" });
    }

    const { userA, userB } = toSortedFriendPair(userId, targetUserId);
    const friendship = await Friend.findOneAndDelete({ userA, userB });

    if (!friendship) {
      return res.status(404).json({ message: "Hai ngÆ°á»i hiá»‡n khÃ´ng cÃ²n lÃ  báº¡n bÃ¨" });
    }

    await FriendRequest.deleteMany({
      status: "pending",
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
              console.error("KhÃƒÂ´ng thÃ¡Â»Æ’ xÃƒÂ³a Ã¡ÂºÂ£nh tin nhÃ¡ÂºÂ¯n trÃƒÂªn Cloudinary:", error);
            });
            return;
          }

          if (message.imgUrl) {
            await deleteImageFromCloudinaryUrl(message.imgUrl).catch((error) => {
              console.error("KhÃƒÂ´ng thÃ¡Â»Æ’ xÃƒÂ³a Ã¡ÂºÂ£nh tin nhÃ¡ÂºÂ¯n trÃƒÂªn Cloudinary:", error);
            });
          }
        })
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
      message: "ÄÃ£ há»§y káº¿t báº¡n thÃ nh cÃ´ng",
      conversationId,
      clearedDirectChat: Boolean(conversationId),
    });
  } catch (error) {
    console.error("Lá»—i khi há»§y káº¿t báº¡n", error);
    return res.status(500).json({ message: "Lá»—i há»‡ thá»‘ng" });
  }
};
