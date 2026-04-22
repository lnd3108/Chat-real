import User from "../../../models/User.js";
import Conversation from "../../../models/Conversation.js";
import Message from "../../../models/Message.js";
import Friend from "../../../models/Friend.js";
import Blocking from "../../../models/Blocking.js";
import Session from "../../../models/Session.js";
import {
  disconnectUserSockets,
  emitToUser,
} from "../../../socket/index.js";
import { permanentlyDeleteUserAccount } from "../../../services/accountDeletionService.js";
import { sendAccountDeletedEmail } from "../../../utils/mail.js";
import {
  ADMIN_SOCKET_EVENTS,
  USER_SOCKET_EVENTS,
} from "../../../constants/socketEvents.js";
import { emitToAdmins } from "../../../shared/infrastructure/realtime/admin-room.js";
import {
  buildAdminActor,
  emitAdminNotification,
} from "../../../services/adminNotificationService.js";
import { emitDashboardStatsUpdated } from "../../../services/dashboardRealtimeService.js";
import {
  buildManageableUserFilter,
  canManageUser,
  serializeUserAccess,
} from "../../../services/rbacService.js";

const buildUserStatusResponse = (user) => ({
  _id: user._id,
  avatar: user.avatarUrl ?? null,
  username: user.userName,
  displayName: user.displayName,
  email: user.email,
  status: user.status,
  createdAt: user.createdAt,
  role: user.role,
});

export const getUsersQuery = async ({ actor, query }) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;
  const searchQuery = query.q || "";
  const status = query.status || "";
  const sort = query.sort || "createdAt";

  const filter = buildManageableUserFilter(actor);

  if (searchQuery.trim()) {
    filter.$or = [
      { userName: { $regex: searchQuery, $options: "i" } },
      { displayName: { $regex: searchQuery, $options: "i" } },
      { email: { $regex: searchQuery, $options: "i" } },
    ];
  }

  if (status && ["active", "inactive", "suspended", "banned"].includes(status)) {
    filter.status = status;
  }

  let sortObj = {};
  if (sort === "username") sortObj = { userName: 1 };
  else if (sort === "displayName") sortObj = { displayName: 1 };
  else sortObj = { createdAt: -1 };

  const users = await User.find(filter)
    .select("-hashedPassword -emailVerificationCodeHash -accountDeletionCodeHash")
    .limit(limit)
    .skip(skip)
    .sort(sortObj);

  const total = await User.countDocuments(filter);

  return {
    users: users.map((user) =>
      serializeUserAccess(typeof user.toObject === "function" ? user.toObject() : user),
    ),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

export const getUserDetailQuery = async ({ actor, userId }) => {
  const user = await User.findById(userId).select(
    "-hashedPassword -emailVerificationCodeHash -accountDeletionCodeHash",
  );

  if (!user) {
    const error = new Error("NgÆ°á»i dÃ¹ng khÃ´ng tá»“n táº¡i");
    error.status = 404;
    throw error;
  }

  if (!canManageUser(actor, user)) {
    const error = new Error("Báº¡n khÃ´ng cÃ³ quyá»n thao tÃ¡c trÃªn tÃ i khoáº£n nÃ y.");
    error.status = 403;
    throw error;
  }

  const [
    friendsCount,
    directConversationsCount,
    groupConversationsCount,
    blockingCount,
    blockedByCount,
    messagesCount,
  ] = await Promise.all([
    Friend.countDocuments({ $or: [{ userA: userId }, { userB: userId }] }),
    Conversation.countDocuments({
      "participants.userId": userId,
      type: "direct",
    }),
    Conversation.countDocuments({
      "participants.userId": userId,
      type: "group",
    }),
    Blocking.countDocuments({ userId, isActive: { $ne: false } }),
    Blocking.countDocuments({ blockedUserId: userId, isActive: { $ne: false } }),
    Message.countDocuments({ senderId: userId }),
  ]);

  const userAccess = serializeUserAccess(
    typeof user.toObject === "function" ? user.toObject() : user,
  );

  return {
    user: {
      _id: user._id,
      avatar: user.avatarUrl ?? null,
      avatarUrl: user.avatarUrl ?? null,
      username: user.userName,
      userName: user.userName,
      displayName: user.displayName,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      role: userAccess.role,
      roleLabel: userAccess.roleLabel,
      roleLevel: userAccess.roleLevel,
      roles: userAccess.roles,
      primaryRole: userAccess.primaryRole,
      permissions: userAccess.permissions,
    },
    stats: {
      friendsCount,
      directConversationsCount,
      groupConversationsCount,
      blockingCount,
      blockedByCount,
      messagesCount,
    },
  };
};

export const updateUserStatusCommand = async ({ actor, userId, status }) => {
  const actorId = actor?._id?.toString();

  if (!["active", "banned"].includes(status)) {
    const error = new Error(
      "Tráº¡ng thÃ¡i khÃ´ng há»£p lá»‡. Chá»‰ há»— trá»£ `active` hoáº·c `banned`.",
    );
    error.status = 400;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("NgÆ°á»i dÃ¹ng khÃ´ng tá»“n táº¡i.");
    error.status = 404;
    throw error;
  }

  if (actorId && actorId === user._id.toString()) {
    const error = new Error("Báº¡n khÃ´ng thá»ƒ tá»± khÃ³a tÃ i khoáº£n cá»§a chÃ­nh mÃ¬nh.");
    error.status = 400;
    throw error;
  }

  if (!canManageUser(actor, user)) {
    const error = new Error("Báº¡n khÃ´ng cÃ³ quyá»n thao tÃ¡c trÃªn tÃ i khoáº£n nÃ y.");
    error.status = 403;
    throw error;
  }

  user.status = status;
  await user.save();

  if (status === "banned") {
    await Session.deleteMany({ userId: user._id });
    emitToUser(user._id, USER_SOCKET_EVENTS.ACCOUNT_LOCKED, {
      message: "Tai khoan cua ban da bi khoa boi quan tri vien.",
    });
    emitToUser(user._id, "account:banned", {
      message: "TÃ i khoáº£n cá»§a báº¡n Ä‘Ã£ bá»‹ khÃ³a bá»Ÿi quáº£n trá»‹ viÃªn.",
    });
    disconnectUserSockets(user._id);
    emitToAdmins(ADMIN_SOCKET_EVENTS.USER_LOCKED, {
      user: buildAdminActor(user),
      actor: buildAdminActor(actor),
      changedAt: new Date().toISOString(),
    });
    emitAdminNotification({
      type: "user",
      title: "Tai khoan da bi khoa",
      message: `${actor.displayName} vua khoa @${user.userName}`,
      link: `/admin/users/${user._id}`,
      entityId: user._id.toString(),
      actor: buildAdminActor(actor),
    });
  } else {
    emitToUser(user._id, USER_SOCKET_EVENTS.ACCOUNT_UNLOCKED, {
      message: "Tai khoan cua ban da duoc mo khoa.",
    });
    emitToAdmins(ADMIN_SOCKET_EVENTS.USER_UNLOCKED, {
      user: buildAdminActor(user),
      actor: buildAdminActor(actor),
      changedAt: new Date().toISOString(),
    });
    emitAdminNotification({
      type: "user",
      title: "Tai khoan da duoc mo khoa",
      message: `${actor.displayName} vua mo khoa @${user.userName}`,
      link: `/admin/users/${user._id}`,
      entityId: user._id.toString(),
      actor: buildAdminActor(actor),
    });
  }

  emitToAdmins(ADMIN_SOCKET_EVENTS.USER_STATUS_CHANGED, {
    user: buildAdminActor(user),
    changedAt: new Date().toISOString(),
  });
  await emitDashboardStatsUpdated({
    reason: status === "banned" ? "user:locked" : "user:unlocked",
    userId: user._id.toString(),
  });

  return {
    message:
      status === "banned"
        ? "ÄÃ£ khÃ³a tÃ i khoáº£n ngÆ°á»i dÃ¹ng."
        : "ÄÃ£ má»Ÿ khÃ³a tÃ i khoáº£n ngÆ°á»i dÃ¹ng.",
    user: buildUserStatusResponse(user),
  };
};

export const deleteUserAsAdminCommand = async ({ actor, targetUserId, reason }) => {
  const actorId = actor?._id?.toString();

  if (actorId && actorId === targetUserId) {
    const error = new Error(
      "Báº¡n khÃ´ng thá»ƒ tá»± xÃ³a tÃ i khoáº£n cá»§a chÃ­nh mÃ¬nh tá»« khu vá»±c admin.",
    );
    error.status = 400;
    throw error;
  }

  const targetUser = await User.findById(targetUserId).select("role");
  if (!targetUser) {
    const error = new Error("NgÆ°á»i dÃ¹ng khÃ´ng tá»“n táº¡i.");
    error.status = 404;
    throw error;
  }

  if (!canManageUser(actor, targetUser)) {
    const error = new Error("Báº¡n khÃ´ng cÃ³ quyá»n thao tÃ¡c trÃªn tÃ i khoáº£n nÃ y.");
    error.status = 403;
    throw error;
  }

  const { user, summary } = await permanentlyDeleteUserAccount({
    targetUserId,
    actorUserId: actor?._id ?? null,
    initiatedBy: "admin",
    reason,
  });

  try {
    await sendAccountDeletedEmail({
      email: user.email,
      displayName: user.displayName,
      deletedByAdmin: true,
      reason,
    });
  } catch (error) {
    console.error("Lá»—i gá»­i email sau khi admin xÃ³a tÃ i khoáº£n", error);
  }

  return {
    message: "TÃ i khoáº£n Ä‘Ã£ Ä‘Æ°á»£c xÃ³a.",
    summary,
  };
};
