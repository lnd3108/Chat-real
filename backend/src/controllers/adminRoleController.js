import User from "../models/User.js";
import {
  getPermissionSnapshotForUser,
  getRoleDefinitionsForActor,
  listAuditLogs,
  updateUserRoleByAdmin,
} from "../services/adminRoleService.js";
import { canManageUser } from "../services/rbacService.js";
import { sendError, sendServerError } from "../utils/controllerResponses.js";

export const getAdminRoles = async (req, res) => {
  try {
    const roles = getRoleDefinitionsForActor(req.user);

    return res.status(200).json({
      success: true,
      data: {
        roles,
        assignableRoles: roles.filter((role) => role.assignable).map((role) => role.key),
      },
    });
  } catch (error) {
    return sendServerError(res, error, {
      logMessage: "Lỗi khi lấy danh sách role admin:",
      message: "Không thể lấy danh sách role.",
    });
  }
};

export const getAdminUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select(
      "displayName userName email avatarUrl role permissions status createdAt updatedAt",
    );

    if (!user) {
      return sendError(res, 404, "Không tìm thấy người dùng.");
    }

    if (!canManageUser(req.user, user)) {
      return sendError(res, 403, "Bạn không có quyền thao tác trên tài khoản này.");
    }

    return res.status(200).json({
      success: true,
      data: {
        user: getPermissionSnapshotForUser(user.toObject()),
      },
    });
  } catch (error) {
    return sendServerError(res, error, {
      logMessage: "Lỗi khi lấy quyền người dùng:",
      message: "Không thể lấy quyền người dùng.",
    });
  }
};

export const patchAdminUserRoles = async (req, res) => {
  try {
    const { userId, id } = req.params;
    const targetUserId = userId ?? id;
    const { role, reason } = req.body ?? {};

    const result = await updateUserRoleByAdmin({
      actor: req.user,
      targetUserId,
      nextRole: role,
      reason,
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật quyền tài khoản thành công.",
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return sendError(res, error.status, error.message);
    }

    return sendServerError(res, error, {
      logMessage: "Lỗi khi cập nhật role người dùng:",
      message: "Không thể cập nhật quyền tài khoản.",
    });
  }
};

export const getAdminAuditLogs = async (req, res) => {
  try {
    const result = await listAuditLogs(req.query ?? {});

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return sendServerError(res, error, {
      logMessage: "Lỗi khi lấy audit log phân quyền:",
      message: "Không thể lấy lịch sử phân quyền.",
    });
  }
};
