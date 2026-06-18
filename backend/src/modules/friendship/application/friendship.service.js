import Conversation from "../../../models/Conversation.js";
import Friend from "../../../models/Friend.js";
import FriendRequest from "../../../models/FriendRequest.js";
import Message from "../../../models/Message.js";
import User from "../../../models/User.js";
import {
  deleteImageFromCloudinary,
  deleteImageFromCloudinaryUrl,
} from "../../../middlewares/uploadMiddleWare.js";
import {
  emitConversationDeletedForUsers,
  emitFriendRemoved,
  emitFriendRequestAccepted,
  emitFriendRequestReceived,
  emitFriendRequestRemoved,
  emitFriendRequestSent,
} from "../../../shared/infrastructure/realtime/friendship-realtime.js";
import { findDirectConversationBetweenUsers } from "../../chat/domain/direct-blocking.policy.js";
import {
  getProtectedFriendshipMessage,
  isProtectedAccount,
} from "../../../services/friendshipPolicyService.js";
import {
  getCachedFriendData,
  invalidateFriendCacheForUsers,
  setCachedFriendData,
} from "../infrastructure/cache/friend-cache.service.js";
import { invalidateConversationListForUsers } from "../../chat/infrastructure/cache/conversation-list-cache.service.js";
import { invalidateAdminDashboardCache } from "../../admin-panel/infrastructure/cache/admin-dashboard-cache.service.js";

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

export const sendFriendRequestCommand = async ({ user, body }) => {
  const { to, message } = body;
  const from = user._id;

  if (from.toString() === to?.toString()) {
    return {
      error: {
        status: 400,
        message: "Không thể gửi lời mời kết bạn cho chính mình",
      },
    };
  }

  const [fromUser, toUser] = await Promise.all([
    User.findById(from)
      .select("_id role userName status displayName avatarUrl")
      .lean(),
    User.findById(to)
      .select("_id role userName status displayName avatarUrl")
      .lean(),
  ]);

  if (!toUser) {
    return { error: { status: 404, message: "Người dùng không tồn tại" } };
  }

  if (isProtectedAccount(fromUser) || isProtectedAccount(toUser)) {
    return { error: { status: 403, message: getProtectedFriendshipMessage() } };
  }

  if (String(toUser.status ?? "").toLowerCase() !== "active") {
    return {
      error: {
        status: 400,
        message: "Người dùng không hợp lệ để kết bạn.",
      },
    };
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
    return { error: { status: 400, message: "Hai người đã là bạn bè" } };
  }

  if (existingRequest) {
    const isReverseRequest =
      existingRequest.from.toString() === to.toString() &&
      existingRequest.to.toString() === from.toString();
    const isPendingRequest =
      (existingRequest.status ?? "pending") === "pending";

    if (isReverseRequest && isPendingRequest) {
      await Friend.create({ userA: from, userB: to });
      await FriendRequest.findByIdAndUpdate(existingRequest._id, {
        $set: { status: "accepted" },
      });

      const acceptancePayload = {
        requestId: existingRequest._id.toString(),
        userA: mapBasicUser(fromUser),
        userB: mapBasicUser(toUser),
      };
      await invalidateFriendCacheForUsers(
        [from, to],
        "friend-request-auto-accepted",
      );
      await invalidateAdminDashboardCache("friend-request-auto-accepted");

      emitFriendRequestAccepted({
        userIds: [from.toString(), to.toString()],
        payload: acceptancePayload,
      });

      return {
        status: 200,
        payload: {
          message: "Hai bạn đã tự động trở thành bạn bè",
          autoAccepted: true,
          matchedRequestId: existingRequest._id,
          newFriend: mapBasicUser(toUser),
        },
      };
    }

    if (!isReverseRequest && isPendingRequest) {
      return {
        error: { status: 400, message: "Đã có lời mời kết bạn đang chờ" },
      };
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
        { new: true },
      );

      const requestPayload = toFriendRequestSocketPayload({
        request,
        fromUser,
        toUser,
      });

      emitFriendRequestReceived({
        toUserId: to.toString(),
        request: requestPayload,
      });
      emitFriendRequestSent({
        fromUserId: from.toString(),
        request: requestPayload,
      });
      await invalidateFriendCacheForUsers(
        [from, to],
        "friend-request-resend",
      );
      await invalidateAdminDashboardCache("friend-request-resend");

      return {
        status: 200,
        payload: {
          message: "Gửi lại lời mời kết bạn thành công",
          autoAccepted: false,
          request: requestPayload,
        },
      };
    }
  }

  const request = await FriendRequest.create({
    from,
    to,
    message,
    status: "pending",
  });
  const requestPayload = toFriendRequestSocketPayload({
    request,
    fromUser,
    toUser,
  });

  emitFriendRequestReceived({
    toUserId: to.toString(),
    request: requestPayload,
  });
  emitFriendRequestSent({
    fromUserId: from.toString(),
    request: requestPayload,
  });
  await invalidateFriendCacheForUsers([from, to], "friend-request-sent");
  await invalidateAdminDashboardCache("friend-request-sent");

  return {
    status: 201,
    payload: {
      message: "Gửi lời mời kết bạn thành công",
      autoAccepted: false,
      request: requestPayload,
    },
  };
};

export const acceptFriendRequestCommand = async ({ user, requestId }) => {
  const userId = user._id;
  const request = await FriendRequest.findById(requestId);
  if (!request) {
    return {
      error: { status: 404, message: "Không tìm thấy lời mời kết bạn" },
    };
  }

  if (request.to.toString() !== userId.toString()) {
    return {
      error: {
        status: 403,
        message: "Bạn không có quyền chấp nhận lời mời kết bạn này",
      },
    };
  }

  if ((request.status ?? "pending") !== "pending") {
    return { error: { status: 400, message: "Lời mời này đã được xử lý" } };
  }

  const { userA, userB } = toSortedFriendPair(request.from, request.to);
  const existingFriend = await Friend.findOne({ userA, userB });
  if (!existingFriend) {
    await Friend.create({ userA: request.from, userB: request.to });
  }

  await FriendRequest.findByIdAndUpdate(requestId, {
    $set: { status: "accepted" },
  });

  const [fromUser, toUser] = await Promise.all([
    User.findById(request.from)
      .select("_id userName displayName avatarUrl")
      .lean(),
    User.findById(request.to)
      .select("_id userName displayName avatarUrl")
      .lean(),
  ]);
  const acceptancePayload = {
    requestId: requestId.toString(),
    userA: mapBasicUser(fromUser),
    userB: mapBasicUser(toUser),
  };

  emitFriendRequestAccepted({
    userIds: [request.from.toString(), request.to.toString()],
    payload: acceptancePayload,
  });
  await invalidateFriendCacheForUsers(
    [request.from, request.to],
    "friend-request-accepted",
  );
  await invalidateAdminDashboardCache("friend-request-accepted");

  return {
    status: 200,
    payload: {
      message: "Chấp nhận lời mời thành công",
      newFriend: mapBasicUser(fromUser),
    },
  };
};

export const declineFriendRequestCommand = async ({ user, requestId }) => {
  const userId = user._id;
  const request = await FriendRequest.findById(requestId);
  if (!request) {
    return {
      error: { status: 404, message: "Không tìm thấy lời mời kết bạn" },
    };
  }

  if (request.to.toString() !== userId.toString()) {
    return {
      error: {
        status: 403,
        message: "Bạn không có quyền từ chối lời mời kết bạn này",
      },
    };
  }

  if ((request.status ?? "pending") !== "pending") {
    return { error: { status: 400, message: "Lời mời này đã được xử lý" } };
  }

  await FriendRequest.findByIdAndUpdate(requestId, {
    $set: { status: "rejected" },
  });

  const payload = {
    requestId: requestId.toString(),
    fromUserId: request.from.toString(),
    toUserId: request.to.toString(),
    reason: "declined",
  };
  emitFriendRequestRemoved({
    userIds: [request.from.toString(), request.to.toString()],
    payload,
  });
  await invalidateFriendCacheForUsers(
    [request.from, request.to],
    "friend-request-declined",
  );
  await invalidateAdminDashboardCache("friend-request-declined");

  return { status: 204, payload: null };
};

export const cancelSentFriendRequestCommand = async ({ user, requestId }) => {
  const userId = user._id;
  const request = await FriendRequest.findById(requestId);
  if (!request) {
    return {
      error: { status: 404, message: "Không tìm thấy lời mời kết bạn" },
    };
  }

  if (request.from.toString() !== userId.toString()) {
    return {
      error: {
        status: 403,
        message: "Bạn không có quyền hủy lời mời kết bạn này",
      },
    };
  }

  if ((request.status ?? "pending") !== "pending") {
    return { error: { status: 400, message: "Lời mời này đã được xử lý" } };
  }

  await FriendRequest.findByIdAndUpdate(requestId, {
    $set: { status: "cancelled" },
  });
  const payload = {
    requestId: requestId.toString(),
    fromUserId: request.from.toString(),
    toUserId: request.to.toString(),
    reason: "cancelled",
  };
  emitFriendRequestRemoved({
    userIds: [request.from.toString(), request.to.toString()],
    payload,
  });
  await invalidateFriendCacheForUsers(
    [request.from, request.to],
    "friend-request-cancelled",
  );
  await invalidateAdminDashboardCache("friend-request-cancelled");

  return {
    status: 200,
    payload: { message: "Đã hủy lời mời kết bạn" },
  };
};

const loadAllFriendsFromMongo = async ({ user }) => {
  const userId = user._id;
  const friendships = await Friend.find({
    $or: [{ userA: userId }, { userB: userId }],
  })
    .populate("userA", "_id displayName avatarUrl userName")
    .populate("userB", "_id displayName avatarUrl userName")
    .lean();

  if (!friendships.length) {
    return { friends: [] };
  }

  const friends = friendships
    .map((friendship) => {
      if (!friendship.userA || !friendship.userB) return null;
      return friendship.userA._id.toString() === userId.toString()
        ? friendship.userB
        : friendship.userA;
    })
    .filter(Boolean);

  return { friends };
};

export const getAllFriendsQuery = async ({ user, query = {} }) => {
  if (!user?._id) {
    return loadAllFriendsFromMongo({ user });
  }

  const cached = await getCachedFriendData({
    type: "list",
    userId: user._id,
    query,
  });

  if (cached.hit) {
    return cached.value;
  }

  const result = await loadAllFriendsFromMongo({ user });
  await setCachedFriendData({
    type: "list",
    userId: user._id,
    query,
    value: result,
  });

  return result;
};

const loadFriendRequestsFromMongo = async ({ user }) => {
  const userId = user._id;
  const populateFields = "_id userName displayName avatarUrl";
  const [sent, received] = await Promise.all([
    FriendRequest.find({ from: userId, status: "pending" })
      .sort({ createdAt: -1 })
      .populate("to", populateFields)
      .lean(),
    FriendRequest.find({ to: userId, status: "pending" })
      .sort({ createdAt: -1 })
      .populate("from", populateFields)
      .lean(),
  ]);

  return { sent, received };
};

export const getFriendRequestsQuery = async ({ user, query = {} }) => {
  if (!user?._id) {
    return loadFriendRequestsFromMongo({ user });
  }

  const cached = await getCachedFriendData({
    type: "requests",
    userId: user._id,
    query,
  });

  if (cached.hit) {
    return cached.value;
  }

  const result = await loadFriendRequestsFromMongo({ user });
  await setCachedFriendData({
    type: "requests",
    userId: user._id,
    query,
    value: result,
  });

  return result;
};

export const removeFriendCommand = async ({ user, targetUserId }) => {
  const userId = user._id;
  if (userId.toString() === targetUserId.toString()) {
    return {
      error: {
        status: 400,
        message: "Không thể hủy kết bạn với chính mình",
      },
    };
  }

  const targetUser = await User.findById(targetUserId).select("_id");
  if (!targetUser) {
    return { error: { status: 404, message: "Người dùng không tồn tại" } };
  }

  const { userA, userB } = toSortedFriendPair(userId, targetUserId);
  const friendship = await Friend.findOneAndDelete({ userA, userB });
  if (!friendship) {
    return {
      error: {
        status: 404,
        message: "Hai người hiện không còn là bạn bè",
      },
    };
  }

  await FriendRequest.deleteMany({
    status: "pending",
    $or: [
      { from: userId, to: targetUserId },
      { from: targetUserId, to: userId },
    ],
  });

  const directConversation = await findDirectConversationBetweenUsers(
    userId,
    targetUserId,
  );
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
          await deleteImageFromCloudinary(message.imgPublicId).catch(
            (error) => {
              console.error(
                "Không thể xóa ảnh tin nhắn trên Cloudinary:",
                error,
              );
            },
          );
          return;
        }

        if (message.imgUrl) {
          await deleteImageFromCloudinaryUrl(message.imgUrl).catch((error) => {
            console.error("Không thể xóa ảnh tin nhắn trên Cloudinary:", error);
          });
        }
      }),
    );

    await Message.deleteMany({ conversationId: directConversation._id });
    await Conversation.deleteOne({ _id: directConversation._id });
    emitConversationDeletedForUsers({
      userIds: [userId.toString(), targetUserId.toString()],
      conversationId,
    });
  }
  await invalidateFriendCacheForUsers([userId, targetUserId], "friend-removed");
  await invalidateConversationListForUsers(
    [userId, targetUserId],
    "friend-removed",
  );
  await invalidateAdminDashboardCache("friend-removed");

  const payload = {
    userId: userId.toString(),
    targetUserId: targetUserId.toString(),
    conversationId,
    clearedDirectChat: Boolean(conversationId),
  };

  emitFriendRemoved({
    userIds: [userId.toString(), targetUserId.toString()],
    payload,
  });

  return {
    status: 200,
    payload: {
      message: "Đã hủy kết bạn thành công",
      conversationId,
      clearedDirectChat: Boolean(conversationId),
    },
  };
};
