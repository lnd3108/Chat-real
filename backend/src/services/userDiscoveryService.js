import Friend from "../models/Friend.js";
import FriendRequest from "../models/FriendRequest.js";
import User from "../models/User.js";
import {
  findRandomDiscoverableUsers,
  searchDiscoverableUsers,
} from "../repositories/userDiscoveryRepository.js";
import {
  isEligibleForFriendship,
  isProtectedAccount,
} from "./friendshipPolicyService.js";
import { escapeRegex } from "../utils/regex.js";

const DEFAULT_SUGGESTION_LIMIT = 5;
const MAX_SUGGESTION_LIMIT = 5;

const getReasonText = (mutualFriendsCount) =>
  mutualFriendsCount > 0 ? `${mutualFriendsCount} bạn chung` : "Gợi ý cho bạn";

const getAcceptedFriendIds = async (userId) => {
  const friendships = await Friend.find({
    $or: [{ userA: userId }, { userB: userId }],
  })
    .select("userA userB")
    .lean();

  return friendships.map((friendship) => {
    const userA = friendship.userA.toString();
    const userB = friendship.userB.toString();

    return userA === userId.toString() ? userB : userA;
  });
};

const getIncomingBlockedUserIds = async (userId) => {
  const blockers = await User.find({
    "blockedUsers.userId": userId,
  })
    .select("_id")
    .lean();

  return blockers.map((user) => user._id.toString());
};

const getPendingFriendRequestMaps = async (userId) => {
  const requests = await FriendRequest.find({
    status: "pending",
    $or: [{ from: userId }, { to: userId }],
  })
    .select("from to")
    .lean();

  const sentTo = new Set();
  const receivedFrom = new Set();

  requests.forEach((request) => {
    const fromId = request.from.toString();
    const toId = request.to.toString();

    if (fromId === userId.toString()) {
      sentTo.add(toId);
    } else if (toId === userId.toString()) {
      receivedFrom.add(fromId);
    }
  });

  return { sentTo, receivedFrom };
};

const getDiscoveryContext = async (userId, includePending = true) => {
  const [viewer, friendIds, incomingBlockedIds, pendingMaps] = await Promise.all([
    User.findById(userId).select("_id role userName status blockedUsers").lean(),
    getAcceptedFriendIds(userId),
    getIncomingBlockedUserIds(userId),
    includePending
      ? getPendingFriendRequestMaps(userId)
      : Promise.resolve({ sentTo: new Set(), receivedFrom: new Set() }),
  ]);

  const blockedByViewerIds = (viewer?.blockedUsers ?? [])
    .map((entry) => entry.userId?.toString())
    .filter(Boolean);

  const excludedIds = new Set([
    userId.toString(),
    ...friendIds.map((id) => id.toString()),
    ...blockedByViewerIds,
    ...incomingBlockedIds,
    ...pendingMaps.sentTo,
    ...pendingMaps.receivedFrom,
  ]);

  return {
    viewer,
    friendIds,
    pendingSentIds: pendingMaps.sentTo,
    pendingReceivedIds: pendingMaps.receivedFrom,
    excludedIds,
  };
};

const sortSearchResults = (users, query) => {
  const normalizedQuery = query.toLowerCase();

  users.sort((left, right) => {
    const leftUserName = left.userName.toLowerCase();
    const rightUserName = right.userName.toLowerCase();
    const leftDisplayName = left.displayName.toLowerCase();
    const rightDisplayName = right.displayName.toLowerCase();

    const leftScore =
      (leftUserName === normalizedQuery ? 8 : 0) +
      (leftDisplayName === normalizedQuery ? 6 : 0) +
      (leftUserName.startsWith(normalizedQuery) ? 4 : 0) +
      (leftDisplayName.startsWith(normalizedQuery) ? 2 : 0);
    const rightScore =
      (rightUserName === normalizedQuery ? 8 : 0) +
      (rightDisplayName === normalizedQuery ? 6 : 0) +
      (rightUserName.startsWith(normalizedQuery) ? 4 : 0) +
      (rightDisplayName.startsWith(normalizedQuery) ? 2 : 0);

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return left.userName.localeCompare(right.userName);
  });
};

const mapDiscoverUser = ({
  user,
  mutualFriendsCount,
  requestSent = false,
  requestReceived = false,
}) => {
  const canSendFriendRequest =
    isEligibleForFriendship(user) && !requestSent && !requestReceived;

  return {
    id: user._id.toString(),
    _id: user._id.toString(),
    fullName: user.displayName,
    displayName: user.displayName,
    username: user.userName,
    userName: user.userName,
    avatar: user.avatarUrl ?? null,
    avatarUrl: user.avatarUrl ?? null,
    mutualFriendsCount,
    reasonText: getReasonText(mutualFriendsCount),
    isFriend: false,
    requestSent,
    requestReceived,
    canSendFriendRequest,
  };
};

const buildDiscoverUsers = async (users, options = {}) => {
  const {
    viewerFriendIds = [],
    pendingSentIds = new Set(),
    pendingReceivedIds = new Set(),
  } = options;

  if (!users.length) {
    return [];
  }

  const viewerFriendSet = new Set(viewerFriendIds.map((id) => id.toString()));
  const candidateIds = users.map((user) => user._id.toString());
  const candidateFriendships = await Friend.find({
    $or: [{ userA: { $in: candidateIds } }, { userB: { $in: candidateIds } }],
  })
    .select("userA userB")
    .lean();

  const candidateFriendMap = new Map(candidateIds.map((id) => [id, new Set()]));

  candidateFriendships.forEach((friendship) => {
    const userA = friendship.userA.toString();
    const userB = friendship.userB.toString();

    if (candidateFriendMap.has(userA)) {
      candidateFriendMap.get(userA).add(userB);
    }

    if (candidateFriendMap.has(userB)) {
      candidateFriendMap.get(userB).add(userA);
    }
  });

  return users.map((user) => {
    const userId = user._id.toString();
    const candidateFriendSet = candidateFriendMap.get(userId) ?? new Set();
    let mutualFriendsCount = 0;

    viewerFriendSet.forEach((friendId) => {
      if (candidateFriendSet.has(friendId)) {
        mutualFriendsCount += 1;
      }
    });

    return mapDiscoverUser({
      user,
      mutualFriendsCount,
      requestSent: pendingSentIds.has(userId),
      requestReceived: pendingReceivedIds.has(userId),
    });
  });
};

export const getUserSuggestionsForViewer = async (
  viewerId,
  limit = DEFAULT_SUGGESTION_LIMIT,
) => {
  const normalizedLimit = Math.max(1, Math.min(limit, MAX_SUGGESTION_LIMIT));
  const { viewer, friendIds, excludedIds } = await getDiscoveryContext(viewerId, true);

  if (!isEligibleForFriendship(viewer) || isProtectedAccount(viewer)) {
    return [];
  }

  const users = await findRandomDiscoverableUsers({
    excludedIds: Array.from(excludedIds),
    limit: normalizedLimit,
  });

  return buildDiscoverUsers(users, { viewerFriendIds: friendIds });
};

export const searchDiscoverableUsersForViewer = async (viewerId, query, limit = 10) => {
  const { viewer, friendIds, pendingSentIds, pendingReceivedIds, excludedIds } =
    await getDiscoveryContext(viewerId, false);

  if (!isEligibleForFriendship(viewer) || isProtectedAccount(viewer)) {
    return [];
  }

  const regex = new RegExp(escapeRegex(query), "i");
  const users = await searchDiscoverableUsers({
    excludedIds: Array.from(excludedIds),
    regex,
    limit,
  });

  sortSearchResults(users, query);

  return buildDiscoverUsers(users, {
    viewerFriendIds: friendIds,
    pendingSentIds,
    pendingReceivedIds,
  });
};
