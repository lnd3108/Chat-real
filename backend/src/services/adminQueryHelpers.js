import User from "../models/User.js";
import Message from "../models/Message.js";
import Blocking, { BLOCKING_TYPE_DIRECT_ONLY } from "../models/Blocking.js";
import { escapeRegex } from "../utils/regex.js";

export const mapAdminUserSummary = (user) => {
  if (!user) return null;

  return {
    _id: user._id,
    displayName: user.displayName,
    userName: user.userName,
    email: user.email ?? null,
    avatarUrl: user.avatarUrl ?? null,
  };
};

export const mapAdminBlockRelation = (block) => ({
  _id: block._id,
  blocker: mapAdminUserSummary(block.userId),
  blockedUser: mapAdminUserSummary(block.blockedUserId),
  isActive: block.isActive !== false,
  createdAt: block.createdAt,
  unblockedAt: block.unblockedAt ?? null,
  type: block.type ?? BLOCKING_TYPE_DIRECT_ONLY,
  reason: block.reason ?? null,
});

export const getAdminBlockSort = (sort = "createdAt-desc") => {
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

export const syncBlockingDocumentsFromEmbeddedState = async () => {
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

export const buildAdminBlockFilter = async ({ q = "", status = "" }) => {
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
    $or: [{ userName: regex }, { displayName: regex }, { email: regex }],
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

export const mapAdminFriendRelation = (friendship) => ({
  _id: friendship._id,
  userA: mapAdminUserSummary(friendship.userA),
  userB: mapAdminUserSummary(friendship.userB),
  status: "accepted",
  createdAt: friendship.createdAt,
});

export const getAdminFriendSort = (sort = "createdAt-desc") => {
  switch (sort) {
    case "createdAt-asc":
      return { createdAt: 1 };
    case "createdAt-desc":
    default:
      return { createdAt: -1 };
  }
};

export const buildAdminFriendFilter = async ({ q = "" }) => {
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

export const mapAdminFriendRequestRelation = (request) => ({
  _id: request._id,
  fromUser: mapAdminUserSummary(request.from),
  toUser: mapAdminUserSummary(request.to),
  message: request.message ?? "",
  status: request.status ?? "pending",
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
});

export const getAdminFriendRequestSort = (sort = "createdAt-desc") => {
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

export const buildAdminFriendRequestFilter = async ({ q = "", status = "" }) => {
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
    $or: [{ from: { $in: matchedUserIds } }, { to: { $in: matchedUserIds } }],
  };

  if (filter.$and) {
    filter.$and.push(participantFilter);
  } else {
    Object.assign(filter, participantFilter);
  }

  return filter;
};

export const mapAdminLastMessage = (lastMessage) => {
  if (!lastMessage) return null;

  return {
    _id: lastMessage._id ?? null,
    content: lastMessage.content ?? null,
    imgUrl: lastMessage.imgUrl ?? null,
    senderId: lastMessage.senderId ?? null,
    senderDisplayName: lastMessage.senderDisplayName ?? null,
    senderAvatar: lastMessage.senderAvatar ?? null,
    createdAt: lastMessage.createdAt ?? null,
  };
};

export const mapAdminConversationSummary = (conversation, messagesCount = 0) => ({
  _id: conversation._id,
  type: conversation.type,
  groupName: conversation.type === "group" ? conversation.group?.name ?? "Nhóm" : null,
  membersCount: Array.isArray(conversation.participants) ? conversation.participants.length : 0,
  messagesCount,
  lastMessage: mapAdminLastMessage(conversation.lastMessage),
  updatedAt: conversation.updatedAt,
  createdAt: conversation.createdAt,
});

export const getAdminConversationSort = (sort = "updatedAt-desc") => {
  switch (sort) {
    case "createdAt-asc":
      return { createdAt: 1 };
    case "createdAt-desc":
      return { createdAt: -1 };
    case "updatedAt-asc":
      return { updatedAt: 1 };
    case "updatedAt-desc":
    default:
      return { updatedAt: -1 };
  }
};

export const buildAdminConversationFilter = async ({ type = "", q = "" }) => {
  const filter = {
    type: { $in: ["direct", "group"] },
  };
  const trimmedType = String(type || "").trim();
  const trimmedQuery = String(q || "").trim();

  if (trimmedType && ["direct", "group"].includes(trimmedType)) {
    filter.type = trimmedType;
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
  const queryConditions = [];

  if (matchedUserIds.length) {
    queryConditions.push({ "participants.userId": { $in: matchedUserIds } });
  }

  queryConditions.push({ "group.name": regex });

  if (queryConditions.length === 0) {
    filter._id = null;
    return filter;
  }

  filter.$or = queryConditions;

  return filter;
};

export const getMessagesCountMap = async (conversationIds = []) => {
  if (!conversationIds.length) {
    return new Map();
  }

  const counts = await Message.aggregate([
    {
      $match: {
        conversationId: { $in: conversationIds },
      },
    },
    {
      $group: {
        _id: "$conversationId",
        count: { $sum: 1 },
      },
    },
  ]);

  return new Map(counts.map((item) => [item._id.toString(), item.count]));
};

export const getDirectBlockStatusForAdmin = async (participantIds = []) => {
  if (participantIds.length !== 2) {
    return null;
  }

  const [userAId, userBId] = participantIds;
  const activeBlocks = await Blocking.find({
    isActive: { $ne: false },
    $or: [
      { userId: userAId, blockedUserId: userBId },
      { userId: userBId, blockedUserId: userAId },
    ],
  }).lean();

  const blockedByA = activeBlocks.some(
    (block) =>
      block.userId?.toString() === userAId.toString() &&
      block.blockedUserId?.toString() === userBId.toString(),
  );
  const blockedByB = activeBlocks.some(
    (block) =>
      block.userId?.toString() === userBId.toString() &&
      block.blockedUserId?.toString() === userAId.toString(),
  );

  return {
    blockedByUserA: blockedByA,
    blockedByUserB: blockedByB,
    hasDirectBlock: blockedByA || blockedByB,
    note: "Block chỉ ảnh hưởng direct 1-1, không ảnh hưởng group chat.",
  };
};
