import { logger } from "../../../../shared/infrastructure/logger/logger.js";
import {
  blockUserCommand,
  cancelEmailChangeCommand,
  deleteMyAccountCommand,
  getAuthMe,
  getBlockedUsersQuery,
  getUserSuggestionsQuery,
  searchUsersQuery,
  sendEmailChangeOtpCommand,
  unblockUserCommand,
  updatePreferencesCommand,
  updateProfileCommand,
  uploadAvatarCommand,
  verifyEmailChangeCommand,
} from "../../application/user-profile.service.js";

export const authMe = async (req, res) => {
  try {
    return res.status(200).json(await getAuthMe({ user: req.user }));
  } catch (error) {
    logger.error("Loi khi goi authMe", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const test = async (_req, res) => res.sendStatus(204);

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

    return res.status(200).json(
      await searchUsersQuery({ user: req.user, query: q, limit }),
    );
  } catch (error) {
    console.error("Loi xay ra khi searchUserByUserName", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const getUserSuggestions = async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 5)
      : 5;

    return res.status(200).json(
      await getUserSuggestionsQuery({ user: req.user, limit }),
    );
  } catch (error) {
    console.error("Loi khi lay user suggestions", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    const result = await uploadAvatarCommand({ user: req.user, file: req.file });
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi khi upload avatar:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const updateMe = async (req, res) => {
  try {
    return res.status(200).json(
      await updateProfileCommand({ user: req.user, body: req.body, req }),
    );
  } catch (error) {
    logger.warn("Loi updateMe", {
      message: error?.message,
      status: error?.status,
    });
    return res.status(error?.status || 500).json({
      success: false,
      message: error?.message || "Loi he thong",
      resendAfter: error?.resendAfter,
    });
  }
};

export const sendEmailChangeOtp = async (req, res) => {
  try {
    return res.status(200).json(
      await sendEmailChangeOtpCommand({ user: req.user, body: req.body, req }),
    );
  } catch (error) {
    logger.warn("Loi sendEmailChangeOtp", {
      message: error?.message,
      status: error?.status,
    });
    return res.status(error?.status || 500).json({
      success: false,
      message: error?.message || "Khong the gui ma xac minh email moi.",
      resendAfter: error?.resendAfter,
    });
  }
};

export const verifyMyEmailChange = async (req, res) => {
  try {
    return res.status(200).json(
      await verifyEmailChangeCommand({ user: req.user, body: req.body }),
    );
  } catch (error) {
    logger.warn("Loi verifyMyEmailChange", {
      message: error?.message,
      status: error?.status,
    });
    return res.status(error?.status || 500).json({
      success: false,
      message: error?.message || "Khong the xac minh email moi.",
    });
  }
};

export const cancelMyEmailChange = async (req, res) => {
  try {
    return res.status(200).json(
      await cancelEmailChangeCommand({ user: req.user, body: req.body }),
    );
  } catch (error) {
    logger.warn("Loi cancelMyEmailChange", {
      message: error?.message,
      status: error?.status,
    });
    return res.status(error?.status || 500).json({
      success: false,
      message: error?.message || "Khong the huy xac minh email moi.",
    });
  }
};

export const updatePreferences = async (req, res) => {
  try {
    return res.status(200).json(
      await updatePreferencesCommand({ user: req.user, body: req.body }),
    );
  } catch (error) {
    console.error("Loi updatePreferences:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    return res.status(200).json(await getBlockedUsersQuery({ user: req.user }));
  } catch (error) {
    console.error("Loi getBlockedUsers:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const blockUser = async (req, res) => {
  try {
    const result = await blockUserCommand({
      user: req.user,
      targetUserId: req.params.targetUserId,
      reason: req.body?.reason,
    });
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi blockUser:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const result = await unblockUserCommand({
      user: req.user,
      targetUserId: req.params.targetUserId,
    });
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi unblockUser:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const deleteMyAccount = async (req, res) => {
  try {
    const result = await deleteMyAccountCommand({ user: req.user, body: req.body });
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    if (result.clearRefreshToken) {
      res.clearCookie("refreshToken");
    }
    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi deleteMyAccount:", error);
    return res.status(error.status || 500).json({
      message: error.message || "Khong the xoa tai khoan. Vui long thu lai.",
    });
  }
};
