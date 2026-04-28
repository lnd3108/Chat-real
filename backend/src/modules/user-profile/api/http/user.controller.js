import {
  makeCommandHandler,
  makeQueryHandler,
} from "../../../../shared/api/http/controller-factory.js";
import {
  makeServerErrorHandler,
  makeStatusMessageErrorHandler,
  makeSuccessFlagErrorHandler,
} from "../../../../shared/api/http/error-handlers.js";
import {
  presentCommandResult,
  presentJson,
  presentNoContent,
} from "../../../../shared/api/http/presenters.js";
import {
  parseQueryInteger,
  parseTrimmedString,
} from "../../../../shared/validation/request-validator.js";
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

export const authMe = makeQueryHandler({
  execute: (req) => getAuthMe({ user: req.user }),
  present: (payload) => presentJson({ body: payload }),
  onError: makeServerErrorHandler({
    logMessage: "Lỗi khi gọi authMe",
    message: "Lỗi hệ thống",
  }),
});

export const test = makeQueryHandler({
  execute: async () => null,
  present: () => presentNoContent(),
  onError: makeServerErrorHandler({
    logMessage: "Lỗi khi gọi user-profile/test",
    message: "Lỗi hệ thống",
  }),
});

export const searchUserByUserName = makeQueryHandler({
  execute: (req) => {
    const query = parseTrimmedString(req.query.q);
    const limit = parseQueryInteger(req.query.limit, {
      min: 1,
      max: 20,
      fallback: 10,
    });

    if (!query) {
      throw Object.assign(new Error("Cần cung cấp từ khóa tìm kiếm."), {
        status: 400,
      });
    }

    return searchUsersQuery({ user: req.user, query, limit });
  },
  present: (payload) => presentJson({ body: payload }),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi xảy ra khi searchUserByUserName",
    fallbackMessage: "Lỗi hệ thống",
  }),
});

export const getUserSuggestions = makeQueryHandler({
  execute: (req) =>
    getUserSuggestionsQuery({
      user: req.user,
      limit: parseQueryInteger(req.query.limit, {
        min: 1,
        max: 5,
        fallback: 5,
      }),
    }),
  present: (payload) => presentJson({ body: payload }),
  onError: makeServerErrorHandler({
    logMessage: "Lỗi khi lấy user suggestions",
    message: "Lỗi hệ thống",
  }),
});

export const uploadAvatar = makeCommandHandler({
  execute: (req) => uploadAvatarCommand({ user: req.user, file: req.file }),
  present: presentCommandResult,
  onError: makeServerErrorHandler({
    logMessage: "Lỗi khi upload avatar",
    message: "Lỗi hệ thống",
  }),
});

export const updateMe = makeCommandHandler({
  execute: (req) =>
    updateProfileCommand({ user: req.user, body: req.body, req }),
  present: (payload) => presentJson({ body: payload }),
  onError: makeSuccessFlagErrorHandler({
    fallbackMessage: "Lỗi hệ thống",
    extraKeys: ["resendAfter"],
  }),
});

export const sendEmailChangeOtp = makeCommandHandler({
  execute: (req) =>
    sendEmailChangeOtpCommand({ user: req.user, body: req.body, req }),
  present: (payload) => presentJson({ body: payload }),
  onError: makeSuccessFlagErrorHandler({
    fallbackMessage: "Không thể gửi mã xác minh email mới.",
    extraKeys: ["resendAfter"],
  }),
});

export const verifyMyEmailChange = makeCommandHandler({
  execute: (req) =>
    verifyEmailChangeCommand({ user: req.user, body: req.body }),
  present: (payload) => presentJson({ body: payload }),
  onError: makeSuccessFlagErrorHandler({
    fallbackMessage: "Không thể xác minh email mới.",
  }),
});

export const cancelMyEmailChange = makeCommandHandler({
  execute: (req) =>
    cancelEmailChangeCommand({ user: req.user, body: req.body }),
  present: (payload) => presentJson({ body: payload }),
  onError: makeSuccessFlagErrorHandler({
    fallbackMessage: "Không thể hủy xác minh email mới.",
  }),
});

export const updatePreferences = makeCommandHandler({
  execute: (req) =>
    updatePreferencesCommand({ user: req.user, body: req.body }),
  present: (payload) => presentJson({ body: payload }),
  onError: makeServerErrorHandler({
    logMessage: "Lỗi updatePreferences",
    message: "Lỗi hệ thống",
  }),
});

export const getBlockedUsers = makeQueryHandler({
  execute: (req) => getBlockedUsersQuery({ user: req.user }),
  present: (payload) => presentJson({ body: payload }),
  onError: makeServerErrorHandler({
    logMessage: "Lỗi getBlockedUsers",
    message: "Lỗi hệ thống",
  }),
});

export const blockUser = makeCommandHandler({
  execute: (req) =>
    blockUserCommand({
      user: req.user,
      targetUserId: req.params.targetUserId,
      reason: req.body?.reason,
    }),
  present: presentCommandResult,
  onError: makeServerErrorHandler({
    logMessage: "Lỗi blockUser",
    message: "Lỗi hệ thống",
  }),
});

export const unblockUser = makeCommandHandler({
  execute: (req) =>
    unblockUserCommand({
      user: req.user,
      targetUserId: req.params.targetUserId,
    }),
  present: presentCommandResult,
  onError: makeServerErrorHandler({
    logMessage: "Lỗi unblockUser",
    message: "Lỗi hệ thống",
  }),
});

export const deleteMyAccount = makeCommandHandler({
  execute: async (req, res) => {
    const result = await deleteMyAccountCommand({
      user: req.user,
      body: req.body,
    });
    if (result?.clearRefreshToken) {
      res.clearCookie("refreshToken");
    }
    return result;
  },
  present: presentCommandResult,
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi deleteMyAccount",
    fallbackMessage: "Không thể xóa tài khoản. Vui lòng thử lại.",
  }),
});
