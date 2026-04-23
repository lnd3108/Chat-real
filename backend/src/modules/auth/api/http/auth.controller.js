import { signInSchema, signUpSchema } from "../../../../libs/validation.js";
import { makeCommandHandler } from "../../../../shared/api/http/controller-factory.js";
import {
  makeServerErrorHandler,
  makeStatusMessageErrorHandler,
  makeValidationErrorHandler,
} from "../../../../shared/api/http/error-handlers.js";
import {
  presentCommandResult,
  presentJson,
  presentRedirect,
} from "../../../../shared/api/http/presenters.js";
import { parseBody } from "../../../../shared/validation/request-validator.js";
import { getGoogleAuthUrl } from "../../application/google-auth.service.js";
import {
  requestPasswordReset,
  resetPasswordWithVerifiedOtp,
  verifyPasswordResetOtp,
} from "../../application/password-recovery.service.js";
import { signUpUser } from "../../application/sign-up.command-service.js";
import {
  refreshAccessToken,
  signInUser,
  signOutUser,
} from "../../application/session.command-service.js";
import { signInWithGoogle } from "../../application/google-sign-in.command-service.js";
import {
  resendEmailVerification,
  verifyEmailWithCode,
} from "../../application/email-verification.command-service.js";
import {
  changePasswordForUser,
  confirmAuthenticatedAccountDeletion,
  requestAuthenticatedAccountDeletion,
} from "../../application/account-management.command-service.js";

export const signUp = makeCommandHandler({
  execute: (req) => signUpUser(parseBody(signUpSchema, req.body)),
  present: presentCommandResult,
  onError: makeValidationErrorHandler({
    logMessage: "Lỗi khi gọi signUp",
    serverMessage: "Lỗi hệ thống",
    validationMessage: "Lỗi xác thực dữ liệu",
  }),
});

export const signIn = makeCommandHandler({
  execute: (req, res) =>
    signInUser({
      ...parseBody(signInSchema, req.body),
      res,
    }),
  present: presentCommandResult,
  onError: makeValidationErrorHandler({
    logMessage: "Lỗi signIn",
    serverMessage: "Lỗi hệ thống",
    validationMessage: "Lỗi xác thực dữ liệu",
  }),
});

export const startGoogleAuth = makeCommandHandler({
  execute: async () => {
    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GOOGLE_CALLBACK_URL
    ) {
      throw Object.assign(
        new Error(
          "Google OAuth chưa được cấu hình đầy đủ.",
        ),
        { status: 500 },
      );
    }

    return getGoogleAuthUrl();
  },
  present: (location) => presentRedirect(location),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi startGoogleAuth",
    fallbackMessage: "Không thể bắt đầu đăng nhập Google",
  }),
});

export const googleCallback = makeCommandHandler({
  execute: (req, res) =>
    signInWithGoogle({
      code: req.body?.code,
      res,
    }),
  present: presentCommandResult,
  onError: makeServerErrorHandler({
    logMessage: "Lỗi googleCallback",
    message: "Đăng nhập Google thất bại",
  }),
});

export const verifyEmailCode = makeCommandHandler({
  execute: (req, res) =>
    verifyEmailWithCode({
      verificationToken: req.body?.verificationToken,
      code: req.body?.code,
      res,
    }),
  present: presentCommandResult,
  onError: makeServerErrorHandler({
    logMessage: "Lỗi verifyEmailCode",
    message: "Xác minh email thất bại",
  }),
});

export const resendVerificationCode = makeCommandHandler({
  execute: (req) =>
    resendEmailVerification({
      verificationToken: req.body?.verificationToken,
    }),
  present: presentCommandResult,
  onError: makeServerErrorHandler({
    logMessage: "Lỗi resendVerificationCode",
    message: "Không thể gửi lại mã xác minh",
  }),
});

export const forgotPassword = makeCommandHandler({
  execute: async (req) => ({
    payload: await requestPasswordReset({
      email: req.body?.email,
      req,
    }),
  }),
  present: ({ payload }) => presentJson({ body: payload }),
  onError: makeStatusMessageErrorHandler({
    fallbackMessage: "Không thể xử lý yêu cầu quên mật khẩu.",
    extraKeys: ["resendAvailableAt", "attemptsRemaining"],
  }),
});

export const verifyForgotPasswordOtp = makeCommandHandler({
  execute: async (req) => ({
    payload: await verifyPasswordResetOtp({
      email: req.body?.email,
      otp: req.body?.otp,
    }),
  }),
  present: ({ payload }) => presentJson({ body: payload }),
  onError: makeStatusMessageErrorHandler({
    fallbackMessage: "Không thể xác minh mã đặt lại mật khẩu.",
    extraKeys: ["attemptsRemaining"],
  }),
});

export const resetForgottenPassword = makeCommandHandler({
  execute: async (req, res) => {
    const payload = await resetPasswordWithVerifiedOtp({
      email: req.body?.email,
      resetToken: req.body?.resetToken,
      resetTokenValue: req.body?.resetTokenValue,
      newPassword: req.body?.newPassword,
      confirmPassword: req.body?.confirmPassword,
    });

    res.clearCookie("refreshToken");
    res.clearCookie("accessToken");

    return { payload };
  },
  present: ({ payload }) => presentJson({ body: payload }),
  onError: makeStatusMessageErrorHandler({
    fallbackMessage: "Không thể đặt lại mật khẩu.",
  }),
});

export const signOut = makeCommandHandler({
  execute: (req, res) =>
    signOutUser({
      cookies: req.cookies,
      authorizationHeader: req.headers.authorization,
      res,
    }),
  present: presentCommandResult,
  onError: makeServerErrorHandler({
    logMessage: "Lỗi khi gọi signOut",
    message: "Lỗi hệ thống",
  }),
});

export const refreshToken = makeCommandHandler({
  execute: (req, res) =>
    refreshAccessToken({
      refreshToken: req.cookies?.refreshToken,
      res,
    }),
  present: presentCommandResult,
  onError: makeServerErrorHandler({
    logMessage: "Lỗi khi gọi refreshToken",
    message: "Lỗi hệ thống",
  }),
});

export const changePassword = makeCommandHandler({
  execute: (req, res) =>
    changePasswordForUser({
      userId: req.user?._id,
      currentPassword: req.body?.currentPassword,
      newPassword: req.body?.newPassword,
      confirmPassword: req.body?.confirmPassword,
      res,
    }),
  present: presentCommandResult,
  onError: makeServerErrorHandler({
    logMessage: "Lỗi khi gọi changePassword",
    message: "Lỗi hệ thống",
  }),
});

export const requestAccountDeletion = makeCommandHandler({
  execute: (req) =>
    requestAuthenticatedAccountDeletion({
      userId: req.user?._id,
    }),
  present: presentCommandResult,
  onError: makeServerErrorHandler({
    logMessage: "Lỗi requestAccountDeletion",
    message:
      "Không thể bắt đầu yêu cầu xóa tài khoản.",
  }),
});

export const confirmAccountDeletion = makeCommandHandler({
  execute: (req, res) =>
    confirmAuthenticatedAccountDeletion({
      user: req.user,
      body: req.body,
      res,
    }),
  present: presentCommandResult,
  onError: makeServerErrorHandler({
    logMessage: "Lỗi confirmAccountDeletion",
    message: "Không thể xóa tài khoản.",
  }),
});
