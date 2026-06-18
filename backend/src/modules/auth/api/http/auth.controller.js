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
import { clearAuthCookies } from "../../../../config/auth-cookies.js";
import { recordSigninPipelineServiceTiming } from "../../../../shared/infrastructure/perf/signin-pipeline-timing.js";

// Các controller cho các endpoint liên quan đến xác thực và quản lý tài khoản
export const signUp = makeCommandHandler({
  execute: (req) => signUpUser(parseBody(signUpSchema, req.body)),
  present: presentCommandResult,
  onError: makeValidationErrorHandler({
    logMessage: "Lỗi khi gọi signUp",
    serverMessage: "Lỗi hệ thống",
    validationMessage: "Lỗi xác thực dữ liệu",
  }),
});

// Controller cho endpoint đăng nhập, sử dụng schema để validate dữ liệu đầu vào
export const signIn = makeCommandHandler({
  execute: async (req, res) => {
    const pipelineTiming = {};
    const result = await signInUser({
      ...parseBody(signInSchema, req.body),
      res,
      pipelineTiming,
    });
    recordSigninPipelineServiceTiming(req, pipelineTiming);
    return result;
  },
  present: presentCommandResult,
  onError: makeValidationErrorHandler({
    logMessage: "Lỗi signIn",
    serverMessage: "Lỗi hệ thống",
    validationMessage: "Lỗi xác thực dữ liệu",
  }),
});

// Controller cho endpoint bắt đầu quá trình đăng nhập bằng Google OAuth
export const startGoogleAuth = makeCommandHandler({
  execute: async () => {
    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GOOGLE_CALLBACK_URL
    ) {
      throw Object.assign(
        new Error("Google OAuth chưa được cấu hình đầy đủ."),
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

// Controller cho endpoint callback sau khi người dùng đăng nhập thành công qua Google OAuth
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

// Controller cho endpoint xác minh email bằng mã OTP
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

// Controller cho endpoint gửi lại mã xác minh email
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

// Controller cho endpoint bắt đầu quá trình quên mật khẩu
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

// Controller cho endpoint xác minh mã OTP đặt lại mật khẩu
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

// Controller cho endpoint đặt lại mật khẩu sau khi đã xác minh mã OTP thành công
export const resetForgottenPassword = makeCommandHandler({
  execute: async (req, res) => {
    const payload = await resetPasswordWithVerifiedOtp({
      email: req.body?.email,
      resetToken: req.body?.resetToken,
      resetTokenValue: req.body?.resetTokenValue,
      newPassword: req.body?.newPassword,
      confirmPassword: req.body?.confirmPassword,
    });

    clearAuthCookies(res);

    return { payload };
  },
  present: ({ payload }) => presentJson({ body: payload }),
  onError: makeStatusMessageErrorHandler({
    fallbackMessage: "Không thể đặt lại mật khẩu.",
  }),
});

// Controller cho endpoint đăng xuất, xóa cookie và token liên quan đến phiên đăng nhập
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

// Controller cho endpoint làm mới token, sử dụng refresh token từ cookie để cấp lại access token mới
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

// Controller cho endpoint đổi mật khẩu, yêu cầu người dùng đã xác thực và cung cấp mật khẩu hiện tại cùng mật khẩu mới
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

// yêu cầu xóa tài khoản, chỉ cho phép ng dùng đã xác thực gửi yêu cầu
export const requestAccountDeletion = makeCommandHandler({
  execute: (req) =>
    requestAuthenticatedAccountDeletion({
      userId: req.user?._id,
    }),
  present: presentCommandResult,
  onError: makeServerErrorHandler({
    logMessage: "Lỗi requestAccountDeletion",
    message: "Không thể bắt đầu yêu cầu xóa tài khoản.",
  }),
});

// xác nhận xóa tài khoản
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
