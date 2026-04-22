import User from "../../../../models/User.js";
import {
  getPermissionSnapshotForUser,
  getRoleDefinitionsForActor,
  listAuditLogs,
  updateUserRoleByAdmin,
} from "../../../../services/adminRoleService.js";
import { canManageUser } from "../../../../services/rbacService.js";
import { makeCommandHandler, makeQueryHandler } from "../../../../shared/api/http/controller-factory.js";
import {
  makeServerErrorHandler,
  makeStatusAwareErrorHandler,
} from "../../../../shared/api/http/error-handlers.js";
import {
  presentSuccessData,
  presentSuccessMessage,
} from "../../../../shared/api/http/presenters.js";

export const getAdminRoles = makeQueryHandler({
  execute: (req) => getRoleDefinitionsForActor(req.user),
  present: (roles) =>
    presentSuccessData({
      roles,
      assignableRoles: roles.filter((role) => role.assignable).map((role) => role.key),
    }),
  onError: makeServerErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch role admin:",
    message: "KhÃƒÂ´ng thÃ¡Â»Æ’ lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch role.",
  }),
});

export const getAdminUserPermissions = makeQueryHandler({
  execute: async (req) => {
    const { id } = req.params;
    const user = await User.findById(id).select(
      "displayName userName email avatarUrl role permissions status createdAt updatedAt",
    );

    if (!user) {
      throw Object.assign(new Error("KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng."), { status: 404 });
    }

    if (!canManageUser(req.user, user)) {
      throw Object.assign(
        new Error("BÃ¡ÂºÂ¡n khÃƒÂ´ng cÃƒÂ³ quyÃ¡Â»Ân thao tÃƒÂ¡c trÃƒÂªn tÃƒÂ i khoÃ¡ÂºÂ£n nÃƒÂ y."),
        { status: 403 },
      );
    }

    return {
      user: getPermissionSnapshotForUser(user.toObject()),
    };
  },
  present: presentSuccessData,
  onError: makeStatusAwareErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi lÃ¡ÂºÂ¥y quyÃ¡Â»Ân ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng:",
    message: "KhÃƒÂ´ng thÃ¡Â»Æ’ lÃ¡ÂºÂ¥y quyÃ¡Â»Ân ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng.",
  }),
});

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
    presentSuccessMessage("CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t quyÃ¡Â»Ân tÃƒÂ i khoÃ¡ÂºÂ£n thÃƒÂ nh cÃƒÂ´ng.", data),
  onError: makeStatusAwareErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t role ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng:",
    message: "KhÃƒÂ´ng thÃ¡Â»Æ’ cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t quyÃ¡Â»Ân tÃƒÂ i khoÃ¡ÂºÂ£n.",
  }),
});

export const getAdminAuditLogs = makeQueryHandler({
  execute: (req) => listAuditLogs(req.query ?? {}),
  present: presentSuccessData,
  onError: makeServerErrorHandler({
    logMessage: "LÃ¡Â»â€”i khi lÃ¡ÂºÂ¥y audit log phÃƒÂ¢n quyÃ¡Â»Ân:",
    message: "KhÃƒÂ´ng thÃ¡Â»Æ’ lÃ¡ÂºÂ¥y lÃ¡Â»â€¹ch sÃ¡Â»Â­ phÃƒÂ¢n quyÃ¡Â»Ân.",
  }),
});
