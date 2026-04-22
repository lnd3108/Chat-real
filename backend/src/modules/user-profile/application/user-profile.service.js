import Blocking, { BLOCKING_TYPE_DIRECT_ONLY } from "../../../models/Blocking.js";
import User from "../../../models/User.js";
import {
  deleteImageFromCloudinary,
  uploadImageFromBuffer,
} from "../../../middlewares/uploadMiddleWare.js";
import { permanentlyDeleteUserAccount } from "../../../services/accountDeletionService.js";
import {
  getUserSuggestionsForViewer,
  searchDiscoverableUsersForViewer,
} from "../../../services/userDiscoveryService.js";
import { serializeUserAccess } from "../../../shared/domain/rbac/access-policy.js";
import { sanitizeUser } from "../../../utils/sanitizeUser.js";
import {
  cancelEmailChangeVerification,
  resendEmailChangeOtp,
  updateMyProfile,
  verifyEmailChangeOtp,
} from "../../../services/emailChangeService.js";
import { emitDirectBlockStatusChanged } from "../../chat/application/conversation.command-service.js";

const formatBlockedUsers = async (blockedUsers = []) => {
  const targetIds = blockedUsers
    .map((entry) => entry.userId?.toString())
    .filter(Boolean);

  if (targetIds.length === 0) {
    return [];
  }

  const users = await User.find({ _id: { $in: targetIds } }).select(
    "userName displayName avatarUrl",
  );
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

export const getAuthMe = async ({ user }) => ({
  user: sanitizeUser(serializeUserAccess(user)),
});

export const searchUsersQuery = async ({ user, query, limit }) =>
  ({
    users: await searchDiscoverableUsersForViewer(user._id, query, limit),
  });

export const getUserSuggestionsQuery = async ({ user, limit }) =>
  ({
    users: await getUserSuggestionsForViewer(user._id, limit),
  });

export const uploadAvatarCommand = async ({ user, file }) => {
  const userId = user._id;
  if (!file) {
    return { error: { status: 400, message: "Khong co file duoc tai len" } };
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
    { new: true },
  ).select("avatarUrl");

  if (!updatedUser.avatarUrl) {
    return { error: { status: 400, message: "Avatar tra ve null" } };
  }

  return { status: 200, payload: { avatarUrl: updatedUser.avatarUrl } };
};

export const updateProfileCommand = async ({ user, body, req }) =>
  updateMyProfile({ userId: user?._id, payload: body || {}, req });

export const sendEmailChangeOtpCommand = async ({ user, body, req }) =>
  resendEmailChangeOtp({ userId: user?._id, newEmail: body?.newEmail, req });

export const verifyEmailChangeCommand = async ({ user, body }) =>
  verifyEmailChangeOtp({
    userId: user?._id,
    newEmail: body?.newEmail,
    otp: body?.otp,
  });

export const cancelEmailChangeCommand = async ({ user, body }) =>
  cancelEmailChangeVerification({
    userId: user?._id,
    newEmail: body?.newEmail ?? null,
  });

export const updatePreferencesCommand = async ({ user, body }) => {
  const userId = user?._id;
  const { theme, showOnlineStatus } = body || {};
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

  return {
    message: "Cap nhat cau hinh thanh cong!",
    user: serializeUserAccess(updatedUser?.toObject?.() || updatedUser),
  };
};

export const getBlockedUsersQuery = async ({ user }) => {
  const currentUser = await User.findById(user?._id).select("blockedUsers");
  return {
    blockedUsers: await formatBlockedUsers(currentUser?.blockedUsers ?? []),
  };
};

export const blockUserCommand = async ({ user, targetUserId, reason }) => {
  const actorId = user?._id;

  if (!targetUserId) {
    return { error: { status: 400, message: "Thieu nguoi dung can chan" } };
  }
  if (actorId.toString() === targetUserId.toString()) {
    return { error: { status: 400, message: "Ban khong the tu chan chinh minh" } };
  }

  const targetUser = await User.findById(targetUserId).select("_id");
  if (!targetUser) {
    return { error: { status: 404, message: "Nguoi dung khong ton tai" } };
  }

  const blockedAt = new Date();
  await User.findByIdAndUpdate(actorId, {
    $pull: { blockedUsers: { userId: targetUserId } },
  });

  const [updatedUser] = await Promise.all([
    User.findByIdAndUpdate(
      actorId,
      {
        $push: {
          blockedUsers: {
            userId: targetUserId,
            reason: reason?.trim() || null,
            createdAt: blockedAt,
          },
        },
      },
      { new: true },
    ).select("blockedUsers"),
    Blocking.findOneAndUpdate(
      {
        userId: actorId,
        blockedUserId: targetUserId,
      },
      {
        $set: {
          reason: reason?.trim() || null,
          isActive: true,
          unblockedAt: null,
          type: BLOCKING_TYPE_DIRECT_ONLY,
          createdAt: blockedAt,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ),
  ]);

  await emitDirectBlockStatusChanged({
    actorUser: user,
    targetUserId,
    isBlocked: true,
  });

  return {
    status: 200,
    payload: {
      message: "Da chan nguoi dung",
      blockedUsers: await formatBlockedUsers(updatedUser?.blockedUsers ?? []),
    },
  };
};

export const unblockUserCommand = async ({ user, targetUserId }) => {
  const actorId = user?._id;
  if (!targetUserId) {
    return { error: { status: 400, message: "Thieu nguoi dung can bo chan" } };
  }

  const unblockedAt = new Date();
  const [updatedUser] = await Promise.all([
    User.findByIdAndUpdate(
      actorId,
      { $pull: { blockedUsers: { userId: targetUserId } } },
      { new: true },
    ).select("blockedUsers"),
    Blocking.findOneAndUpdate(
      {
        userId: actorId,
        blockedUserId: targetUserId,
      },
      {
        $set: {
          isActive: false,
          unblockedAt,
          type: BLOCKING_TYPE_DIRECT_ONLY,
        },
      },
      { new: true },
    ),
  ]);

  await emitDirectBlockStatusChanged({
    actorUser: user,
    targetUserId,
    isBlocked: false,
  });

  return {
    status: 200,
    payload: {
      message: "Da bo chan nguoi dung",
      blockedUsers: await formatBlockedUsers(updatedUser?.blockedUsers ?? []),
    },
  };
};

export const deleteMyAccountCommand = async ({ user, body }) => {
  const userId = user?._id;
  const { code, confirmationText } = body || {};

  if (String(confirmationText || "").trim().toUpperCase() !== "DELETE") {
    return {
      error: {
        status: 400,
        message: 'Vui long nhap dung "DELETE" de xac nhan xoa tai khoan.',
      },
    };
  }

  if (!code) {
    return { error: { status: 400, message: "Vui long nhap ma xac minh." } };
  }

  const currentUser = await User.findById(userId);
  if (!currentUser) {
    return { error: { status: 404, message: "Khong tim thay nguoi dung." } };
  }

  if (!currentUser.accountDeletionCodeHash || !currentUser.accountDeletionExpiresAt) {
    return {
      error: {
        status: 400,
        message: "Khong tim thay yeu cau xoa tai khoan dang hoat dong.",
      },
    };
  }

  if (currentUser.accountDeletionExpiresAt < new Date()) {
    currentUser.accountDeletionCodeHash = undefined;
    currentUser.accountDeletionExpiresAt = undefined;
    currentUser.accountDeletionLastSentAt = undefined;
    await currentUser.save();

    return {
      error: {
        status: 400,
        message:
          "Yeu cau xoa tai khoan da het han sau 5 phut. Vui long tao lai yeu cau moi.",
      },
    };
  }

  const crypto = await import("crypto");
  const providedCodeHash = crypto
    .createHash("sha256")
    .update(String(code).trim())
    .digest("hex");

  if (providedCodeHash !== currentUser.accountDeletionCodeHash) {
    return { error: { status: 400, message: "Ma xac minh khong dung." } };
  }

  const { sendAccountDeletedEmail } = await import("../../../utils/mail.js");
  const accountEmail = currentUser.email;
  const displayName = currentUser.displayName;

  const { summary } = await permanentlyDeleteUserAccount({
    targetUserId: currentUser._id,
    actorUserId: currentUser._id,
    initiatedBy: "self",
  });

  try {
    await sendAccountDeletedEmail({ email: accountEmail, displayName });
  } catch (mailError) {
    console.error("Loi sendAccountDeletedEmail", mailError);
  }

  return {
    status: 200,
    clearRefreshToken: true,
    payload: {
      success: true,
      message: "Tai khoan da duoc xoa.",
      data: summary,
    },
  };
};
