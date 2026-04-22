import { makeCommandHandler, makeQueryHandler } from "../../../../shared/api/http/controller-factory.js";
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
    logMessage: "Loi khi goi authMe",
    message: "Loi he thong",
  }),
});

export const test = makeQueryHandler({
  execute: async () => null,
  present: () => presentNoContent(),
  onError: makeServerErrorHandler({
    logMessage: "Loi khi goi user-profile/test",
    message: "Loi he thong",
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
      throw Object.assign(new Error("Can cung cap tu khoa tim kiem."), { status: 400 });
    }

    return searchUsersQuery({ user: req.user, query, limit });
  },
  present: (payload) => presentJson({ body: payload }),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Loi xay ra khi searchUserByUserName",
    fallbackMessage: "Loi he thong",
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
    logMessage: "Loi khi lay user suggestions",
    message: "Loi he thong",
  }),
});

export const uploadAvatar = makeCommandHandler({
  execute: (req) => uploadAvatarCommand({ user: req.user, file: req.file }),
  present: presentCommandResult,
  onError: makeServerErrorHandler({
    logMessage: "Loi khi upload avatar",
    message: "Loi he thong",
  }),
});

export const updateMe = makeCommandHandler({
  execute: (req) =>
    updateProfileCommand({ user: req.user, body: req.body, req }),
  present: (payload) => presentJson({ body: payload }),
  onError: makeSuccessFlagErrorHandler({
    fallbackMessage: "Loi he thong",
    extraKeys: ["resendAfter"],
  }),
});

export const sendEmailChangeOtp = makeCommandHandler({
  execute: (req) =>
    sendEmailChangeOtpCommand({ user: req.user, body: req.body, req }),
  present: (payload) => presentJson({ body: payload }),
  onError: makeSuccessFlagErrorHandler({
    fallbackMessage: "Khong the gui ma xac minh email moi.",
    extraKeys: ["resendAfter"],
  }),
});

export const verifyMyEmailChange = makeCommandHandler({
  execute: (req) =>
    verifyEmailChangeCommand({ user: req.user, body: req.body }),
  present: (payload) => presentJson({ body: payload }),
  onError: makeSuccessFlagErrorHandler({
    fallbackMessage: "Khong the xac minh email moi.",
  }),
});

export const cancelMyEmailChange = makeCommandHandler({
  execute: (req) =>
    cancelEmailChangeCommand({ user: req.user, body: req.body }),
  present: (payload) => presentJson({ body: payload }),
  onError: makeSuccessFlagErrorHandler({
    fallbackMessage: "Khong the huy xac minh email moi.",
  }),
});

export const updatePreferences = makeCommandHandler({
  execute: (req) =>
    updatePreferencesCommand({ user: req.user, body: req.body }),
  present: (payload) => presentJson({ body: payload }),
  onError: makeServerErrorHandler({
    logMessage: "Loi updatePreferences",
    message: "Loi he thong",
  }),
});

export const getBlockedUsers = makeQueryHandler({
  execute: (req) => getBlockedUsersQuery({ user: req.user }),
  present: (payload) => presentJson({ body: payload }),
  onError: makeServerErrorHandler({
    logMessage: "Loi getBlockedUsers",
    message: "Loi he thong",
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
    logMessage: "Loi blockUser",
    message: "Loi he thong",
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
    logMessage: "Loi unblockUser",
    message: "Loi he thong",
  }),
});

export const deleteMyAccount = makeCommandHandler({
  execute: async (req, res) => {
    const result = await deleteMyAccountCommand({ user: req.user, body: req.body });
    if (result?.clearRefreshToken) {
      res.clearCookie("refreshToken");
    }
    return result;
  },
  present: presentCommandResult,
  onError: makeStatusMessageErrorHandler({
    logMessage: "Loi deleteMyAccount",
    fallbackMessage: "Khong the xoa tai khoan. Vui long thu lai.",
  }),
});
