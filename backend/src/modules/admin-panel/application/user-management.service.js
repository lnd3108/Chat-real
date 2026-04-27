import User from "../../../models/User.js";
import Conversation from "../../../models/Conversation.js";
import Message from "../../../models/Message.js";
import Friend from "../../../models/Friend.js";
import Blocking from "../../../models/Blocking.js";
import Session from "../../../models/Session.js";
import { disconnectUserSockets, emitToUser } from "../../../socket/index.js";
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

// Hàm giúp xây dựng phản hồi người dùng sau khi cập nhật trạng thái
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

// Lấy danh sách người dùng với phân trang, tìm kiếm và lọc trạng thái
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

  if (
    status &&
    ["active", "inactive", "suspended", "banned"].includes(status)
  ) {
    filter.status = status;
  }

  let sortObj = {};
  if (sort === "username") sortObj = { userName: 1 };
  else if (sort === "displayName") sortObj = { displayName: 1 };
  else sortObj = { createdAt: -1 };

  const users = await User.find(filter)
    .select(
      "-hashedPassword -emailVerificationCodeHash -accountDeletionCodeHash",
    )
    .limit(limit)
    .skip(skip)
    .sort(sortObj);

  const total = await User.countDocuments(filter);

  return {
    users: users.map((user) =>
      serializeUserAccess(
        typeof user.toObject === "function" ? user.toObject() : user,
      ),
    ),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Lấy chi tiết người dùng và các thống kê liên quan
export const getUserDetailQuery = async ({ actor, userId }) => {
  const user = await User.findById(userId).select(
    "-hashedPassword -emailVerificationCodeHash -accountDeletionCodeHash",
  );

  if (!user) {
    const error = new Error("Người dùng không tồn tại");
    error.status = 404;
    throw error;
  }

  if (!canManageUser(actor, user)) {
    const error = new Error("Bạn không có quyền thao tác trên tài khoản này.");
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
    Blocking.countDocuments({
      blockedUserId: userId,
      isActive: { $ne: false },
    }),
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
// Cập nhật trạng thái người dùng (kích hoạt / khóa)
export const updateUserStatusCommand = async ({ actor, userId, status }) => {
  const actorId = actor?._id?.toString();

  if (!["active", "banned"].includes(status)) {
    const error = new Error(
      "Trạng thái không hợp lệ. Chỉ hỗ trợ `active` hoặc `banned`.",
    );
    error.status = 400;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("Người dùng không tồn tại.");
    error.status = 404;
    throw error;
  }

  if (actorId && actorId === user._id.toString()) {
    const error = new Error("Bạn không thể tự khóa tài khoản của chính mình.");
    error.status = 400;
    throw error;
  }

  if (!canManageUser(actor, user)) {
    const error = new Error("Bạn không có quyền thao tác trên tài khoản này.");
    error.status = 403;
    throw error;
  }

  user.status = status;
  await user.save();

  if (status === "banned") {
    await Session.deleteMany({ userId: user._id });
    emitToUser(user._id, USER_SOCKET_EVENTS.ACCOUNT_LOCKED, {
      message: "Tài khoản của bạn đã bị khóa bởi quản trị viên.",
    });
    emitToUser(user._id, "account:banned", {
      message: "Tài khoản của bạn đã bị khóa bởi quản trị viên.",
    });
    disconnectUserSockets(user._id);
    emitToAdmins(ADMIN_SOCKET_EVENTS.USER_LOCKED, {
      user: buildAdminActor(user),
      actor: buildAdminActor(actor),
      changedAt: new Date().toISOString(),
    });
    emitAdminNotification({
      type: "user",
      title: "Tài khoản đã bị khóa",
      message: `${actor.displayName} vừa khóa @${user.userName}`,
      link: `/admin/users/${user._id}`,
      entityId: user._id.toString(),
      actor: buildAdminActor(actor),
    });
  } else {
    emitToUser(user._id, USER_SOCKET_EVENTS.ACCOUNT_UNLOCKED, {
      message: "Tài khoản của bạn đã được mở khóa.",
    });
    emitToAdmins(ADMIN_SOCKET_EVENTS.USER_UNLOCKED, {
      user: buildAdminActor(user),
      actor: buildAdminActor(actor),
      changedAt: new Date().toISOString(),
    });
    emitAdminNotification({
      type: "user",
      title: "Tài khoản đã được mở khóa",
      message: `${actor.displayName} vừa mở khóa @${user.userName}`,
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
        ? "Đã khóa tài khoản người dùng."
        : "Đã mở khóa tài khoản người dùng.",
    user: buildUserStatusResponse(user),
  };
};

// Xóa tài khoản người dùng vĩnh viễn từ khu vực admin
export const deleteUserAsAdminCommand = async ({
  actor,
  targetUserId,
  reason,
}) => {
  const actorId = actor?._id?.toString();

  if (actorId && actorId === targetUserId) {
    const error = new Error(
      "Bạn không thể tự xóa tài khoản của chính mình từ khu vực admin.",
    );
    error.status = 400;
    throw error;
  }

  const targetUser = await User.findById(targetUserId).select("role");
  if (!targetUser) {
    const error = new Error("Người dùng không tồn tại.");
    error.status = 404;
    throw error;
  }

  if (!canManageUser(actor, targetUser)) {
    const error = new Error("Bạn không có quyền thao tác trên tài khoản này.");
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
    console.error("Lỗi gửi email sau khi admin xóa tài khoản", error);
  }

  return {
    message: "Tài khoản đã được xóa.",
    summary,
  };
};
