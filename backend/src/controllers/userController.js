import {
  deleteImageFromCloudinary,
  uploadImageFromBuffer,
} from "../middlewares/uploadMiddleWare.js";
import Friend from "../models/Friend.js";
import FriendRequest from "../models/FriendRequest.js";
import User from "../models/User.js";
import { permanentlyDeleteUserAccount } from "../services/accountDeletionService.js";
import { emitDirectBlockStatusChanged } from "./conversationController.js";

const formatBlockedUsers = async (blockedUsers = []) => {
  const targetIds = blockedUsers
    .map((entry) => entry.userId?.toString())
    .filter(Boolean);

  if (targetIds.length === 0) {
    return [];
  }

  const users = await User.find({
    _id: { $in: targetIds },
  }).select("userName displayName avatarUrl");

  const usersById = new Map(users.map((user) => [user._id.toString(), user]));

  return blockedUsers
    .map((entry) => {
      const targetUser = usersById.get(entry.userId?.toString());
      if (!targetUser) return null;

      return {
        _id: targetUser._id,
        userName: targetUser.userName,
        displayName: targetUser.displayName,
        avatarUrl: targetUser.avatarUrl ?? null,
        reason: entry.reason ?? null,
        createdAt: entry.createdAt,
      };
    })
    .filter(Boolean);
};

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const shuffleArray = (items = []) => {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
};

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

const buildUserConnectionPayload = async (users, options = {}) => {
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

    return {
      _id: user._id,
      username: user.userName,
      userName: user.userName,
      displayName: user.displayName,
      avatar: user.avatarUrl ?? null,
      avatarUrl: user.avatarUrl ?? null,
      mutualFriendsCount,
      isFriend: viewerFriendSet.has(userId),
      requestSent: pendingSentIds.has(userId),
      requestReceived: pendingReceivedIds.has(userId),
    };
  });
};

const getDiscoveryContext = async (userId, includePending = true) => {
  const [viewer, friendIds, incomingBlockedIds, pendingMaps] = await Promise.all([
    User.findById(userId).select("blockedUsers").lean(),
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
    friendIds,
    pendingSentIds: pendingMaps.sentTo,
    pendingReceivedIds: pendingMaps.receivedFrom,
    excludedIds,
  };
};

const normalizeString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
};

export const authMe = async (req, res) => {
  try {
    const user = req.user;

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Loi khi goi authMe", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const test = async (req, res) => res.sendStatus(204);

export const searchUserByUserName = async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 20)
      : 10;

    if (!q) {
      return res.status(400).json({ message: "Can cung cap tu khoa tim kiem." });
    }

    const { friendIds, pendingSentIds, pendingReceivedIds, excludedIds } =
      await getDiscoveryContext(req.user._id, false);

    const regex = new RegExp(escapeRegex(q), "i");
    const users = await User.find({
      _id: { $nin: Array.from(excludedIds) },
      $or: [{ userName: regex }, { displayName: regex }],
    })
      .select("_id displayName userName avatarUrl")
      .limit(limit)
      .lean();

    const normalizedQuery = q.toLowerCase();
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

    const usersWithMeta = await buildUserConnectionPayload(users, {
      viewerFriendIds: friendIds,
      pendingSentIds,
      pendingReceivedIds,
    });

    return res.status(200).json({ users: usersWithMeta });
  } catch (error) {
    console.error("Loi xay ra khi searchUserByUserName", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const getUserSuggestions = async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 20)
      : 10;

    const { friendIds, pendingSentIds, pendingReceivedIds, excludedIds } =
      await getDiscoveryContext(req.user._id, true);

    const friendIdSet = new Set(friendIds.map((id) => id.toString()));
    const suggestionIds = new Set();

    if (friendIds.length > 0) {
      const friendEdges = await Friend.find({
        $or: [{ userA: { $in: friendIds } }, { userB: { $in: friendIds } }],
      })
        .select("userA userB")
        .lean();

      friendEdges.forEach((edge) => {
        const userA = edge.userA.toString();
        const userB = edge.userB.toString();

        if (friendIdSet.has(userA) && !excludedIds.has(userB)) {
          suggestionIds.add(userB);
        }

        if (friendIdSet.has(userB) && !excludedIds.has(userA)) {
          suggestionIds.add(userA);
        }
      });
    }

    let candidateIds = Array.from(suggestionIds);

    if (candidateIds.length < limit) {
      const fallbackUsers = await User.find({
        _id: { $nin: [...Array.from(excludedIds), ...candidateIds] },
      })
        .select("_id")
        .limit(limit * 5)
        .lean();

      candidateIds = [
        ...candidateIds,
        ...shuffleArray(fallbackUsers.map((user) => user._id.toString())),
      ];
    }

    const candidateUsers = await User.find({
      _id: { $in: Array.from(new Set(candidateIds)).slice(0, limit * 3) },
    })
      .select("_id displayName userName avatarUrl")
      .lean();

    const usersWithMeta = await buildUserConnectionPayload(candidateUsers, {
      viewerFriendIds: friendIds,
      pendingSentIds,
      pendingReceivedIds,
    });

    usersWithMeta.sort((left, right) => {
      if (right.mutualFriendsCount !== left.mutualFriendsCount) {
        return right.mutualFriendsCount - left.mutualFriendsCount;
      }

      return left.username.localeCompare(right.username);
    });

    return res.status(200).json({ users: usersWithMeta.slice(0, limit) });
  } catch (error) {
    console.error("Loi khi lay user suggestions", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    const file = req.file;
    const userId = req.user._id;

    if (!file) {
      return res.status(400).json({ message: "Khong co file duoc tai len" });
    }

    const currentUser = await User.findById(userId).select("avatarId");
    const result = await uploadImageFromBuffer(file.buffer);

    if (currentUser?.avatarId) {
      await deleteImageFromCloudinary(currentUser.avatarId).catch((error) => {
        console.error("Khong the xoa avatar cu tren Cloudinary:", error);
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        avatarUrl: result.secure_url,
        avatarId: result.public_id,
      },
      {
        new: true,
      },
    ).select("avatarUrl");

    if (!updatedUser.avatarUrl) {
      return res.status(400).json({ message: "Avatar tra ve null" });
    }

    return res.status(200).json({ avatarUrl: updatedUser.avatarUrl });
  } catch (error) {
    console.error("Loi khi upload avatar:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const updateMe = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { displayName, userName, email, phone, bio } = req.body || {};

    if (!req.body) {
      return res.status(400).json({ message: "Thieu du lieu cap nhat" });
    }

    if (userName) {
      const existedUserName = await User.findOne({
        userName: userName.toLowerCase().trim(),
        _id: { $ne: userId },
      });

      if (existedUserName) {
        return res.status(409).json({ message: "Username da ton tai" });
      }
    }

    if (email) {
      const existedEmail = await User.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: userId },
      });

      if (existedEmail) {
        return res.status(409).json({ message: "Email da ton tai" });
      }
    }

    const updates = {};

    const normalizedDisplayName = normalizeString(displayName);
    const normalizedUserName = normalizeString(userName);
    const normalizedEmail = normalizeString(email);
    const normalizedPhone = normalizeString(phone);
    const normalizedBio = bio === undefined ? undefined : bio === "" ? null : bio;

    if (normalizedDisplayName !== undefined) updates.displayName = normalizedDisplayName;
    if (normalizedUserName !== undefined) {
      updates.userName = normalizedUserName?.toLowerCase();
    }
    if (normalizedEmail !== undefined) updates.email = normalizedEmail?.toLowerCase();
    if (normalizedPhone !== undefined) updates.phone = normalizedPhone;
    if (normalizedBio !== undefined) updates.bio = normalizedBio;

    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).select("-hashedPassword");

    const userObject = updatedUser?.toObject?.() || updatedUser;
    const safeUser = {
      ...userObject,
      phone: userObject?.phone ?? null,
      bio: userObject?.bio ?? null,
    };

    return res.status(200).json({
      message: "Cap nhat thong tin thanh cong!",
      user: safeUser,
    });
  } catch (error) {
    console.error("Loi updateMe:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const updatePreferences = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { theme, showOnlineStatus } = req.body || {};

    const updates = {};

    if (theme) updates["preferences.theme"] = theme;

    if (typeof showOnlineStatus === "boolean") {
      updates["preferences.showOnlineStatus"] = showOnlineStatus;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true },
    ).select("-hashedPassword");

    return res.status(200).json({
      message: "Cap nhat cau hinh thanh cong!",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Loi updatePreferences:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user?._id).select("blockedUsers");

    return res.status(200).json({
      blockedUsers: await formatBlockedUsers(user?.blockedUsers ?? []),
    });
  } catch (error) {
    console.error("Loi getBlockedUsers:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const blockUser = async (req, res) => {
  try {
    const actorId = req.user?._id;
    const { targetUserId } = req.params;
    const { reason } = req.body || {};

    if (!targetUserId) {
      return res.status(400).json({ message: "Thieu nguoi dung can chan" });
    }

    if (actorId.toString() === targetUserId.toString()) {
      return res.status(400).json({ message: "Ban khong the tu chan chinh minh" });
    }

    const targetUser = await User.findById(targetUserId).select("_id");
    if (!targetUser) {
      return res.status(404).json({ message: "Nguoi dung khong ton tai" });
    }

    await User.findByIdAndUpdate(actorId, {
      $pull: { blockedUsers: { userId: targetUserId } },
    });

    const updatedUser = await User.findByIdAndUpdate(
      actorId,
      {
        $push: {
          blockedUsers: {
            userId: targetUserId,
            reason: reason?.trim() || null,
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    ).select("blockedUsers");

    await emitDirectBlockStatusChanged({
      actorUser: req.user,
      targetUserId,
      isBlocked: true,
    });

    return res.status(200).json({
      message: "Da chan nguoi dung",
      blockedUsers: await formatBlockedUsers(updatedUser?.blockedUsers ?? []),
    });
  } catch (error) {
    console.error("Loi blockUser:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const actorId = req.user?._id;
    const { targetUserId } = req.params;

    if (!targetUserId) {
      return res.status(400).json({ message: "Thieu nguoi dung can bo chan" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      actorId,
      {
        $pull: { blockedUsers: { userId: targetUserId } },
      },
      { new: true },
    ).select("blockedUsers");

    await emitDirectBlockStatusChanged({
      actorUser: req.user,
      targetUserId,
      isBlocked: false,
    });

    return res.status(200).json({
      message: "Da bo chan nguoi dung",
      blockedUsers: await formatBlockedUsers(updatedUser?.blockedUsers ?? []),
    });
  } catch (error) {
    console.error("Loi unblockUser:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const deleteMyAccount = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { code, confirmationText } = req.body || {};

    if (String(confirmationText || "").trim().toUpperCase() !== "DELETE") {
      return res.status(400).json({
        message: 'Vui lòng nhập đúng "DELETE" để xác nhận xóa tài khoản.',
      });
    }

    if (!code) {
      return res.status(400).json({ message: "Vui lòng nhập mã xác minh." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    if (!user.accountDeletionCodeHash || !user.accountDeletionExpiresAt) {
      return res.status(400).json({
        message: "Không tìm thấy yêu cầu xóa tài khoản đang hoạt động.",
      });
    }

    if (user.accountDeletionExpiresAt < new Date()) {
      user.accountDeletionCodeHash = undefined;
      user.accountDeletionExpiresAt = undefined;
      user.accountDeletionLastSentAt = undefined;
      await user.save();

      return res.status(400).json({
        message:
          "Yêu cầu xóa tài khoản đã hết hạn sau 5 phút. Vui lòng tạo lại yêu cầu mới.",
      });
    }

    const crypto = await import("crypto");
    const providedCodeHash = crypto
      .createHash("sha256")
      .update(String(code).trim())
      .digest("hex");

    if (providedCodeHash !== user.accountDeletionCodeHash) {
      return res.status(400).json({ message: "Mã xác minh không đúng." });
    }

    const { sendAccountDeletedEmail } = await import("../utils/mail.js");
    const accountEmail = user.email;
    const displayName = user.displayName;

    const { summary } = await permanentlyDeleteUserAccount({
      targetUserId: user._id,
      actorUserId: user._id,
      initiatedBy: "self",
    });

    res.clearCookie("refreshToken");

    try {
      await sendAccountDeletedEmail({
        email: accountEmail,
        displayName,
      });
    } catch (mailError) {
      console.error("Loi sendAccountDeletedEmail", mailError);
    }

    return res.status(200).json({
      success: true,
      message: "Tài khoản đã được xóa.",
      data: summary,
    });
  } catch (error) {
    console.error("Loi deleteMyAccount:", error);
    return res.status(error.status || 500).json({
      message: error.message || "Không thể xóa tài khoản. Vui lòng thử lại.",
    });
  }
};
