import User from "../../../../models/User.js";
import {
  getPermissionSnapshotForUser,
  getRoleDefinitionsForActor,
  listAuditLogs,
  updateUserRoleByAdmin,
} from "../../../../services/adminRoleService.js";
import { canManageUser } from "../../../../services/rbacService.js";
import {
  makeCommandHandler,
  makeQueryHandler,
} from "../../../../shared/api/http/controller-factory.js";
import {
  makeServerErrorHandler,
  makeStatusAwareErrorHandler,
} from "../../../../shared/api/http/error-handlers.js";
import {
  presentSuccessData,
  presentSuccessMessage,
} from "../../../../shared/api/http/presenters.js";

// Hàm xử lý để lấy danh sách role admin và role có thể gán được cho người dùng hiện tại
export const getAdminRoles = makeQueryHandler({
  execute: (req) => getRoleDefinitionsForActor(req.user),
  present: (roles) =>
    presentSuccessData({
      roles,
      assignableRoles: roles
        .filter((role) => role.assignable)
        .map((role) => role.key),
    }),
  onError: makeServerErrorHandler({
    logMessage: "Lỗi khi lấy danh sách role admin:",
    message: "Không thể lấy danh sách role.",
  }),
});

// Hàm xử lý để lấy thông tin quyền của một người dùng cụ thể
export const getAdminUserPermissions = makeQueryHandler({
  execute: async (req) => {
    const { id } = req.params;
    const user = await User.findById(id).select(
      "displayName userName email avatarUrl role permissions status createdAt updatedAt",
    );

    if (!user) {
      throw Object.assign(new Error("Không tìm thấy người dùng."), {
        status: 404,
      });
    }

    if (!canManageUser(req.user, user)) {
      throw Object.assign(
        new Error("Bạn không có quyền thao tác trên tài khoản này."),
        { status: 403 },
      );
    }

    return {
      user: getPermissionSnapshotForUser(user.toObject()),
    };
  },
  present: presentSuccessData,
  onError: makeStatusAwareErrorHandler({
    logMessage: "Lỗi khi lấy quyền người dùng:",
    message: "Không thể lấy quyền người dùng.",
  }),
});

// Hàm xử lý để cập nhật role của một người dùng cụ thể
export const patchAdminUserRoles = makeCommandHandler({
  execute: (req) => {
    const { userId, id } = req.params;
    const targetUserId = userId ?? id;
    const { role, reason } = req.body ?? {};

    return updateUserRoleByAdmin({
      actor: req.user,
      targetUserId,
      nextRole: role,
      reason,
    });
  },
  present: (data) =>
    presentSuccessMessage("Cập nhật quyền tài khoản thành công.", data),
  onError: makeStatusAwareErrorHandler({
    logMessage: "Lỗi khi cập nhật role người dùng:",
    message: "Không thể cập nhật quyền tài khoản.",
  }),
});

// Hàm xử lý để lấy lịch sử phân quyền của một người dùng cụ thể
export const getAdminAuditLogs = makeQueryHandler({
  execute: (req) => listAuditLogs(req.query ?? {}),
  present: presentSuccessData,
  onError: makeServerErrorHandler({
    logMessage: "Lỗi khi lấy audit log phân quyền:",
    message: "Không thể lấy lịch sử phân quyền.",
  }),
});
