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
    logMessage: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi gÃƒÂ¡Ã‚Â»Ã‚Âi signUp",
    serverMessage: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i hÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡ thÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœng",
    validationMessage: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i xÃƒÆ’Ã‚Â¡c thÃƒÂ¡Ã‚Â»Ã‚Â±c dÃƒÂ¡Ã‚Â»Ã‚Â¯ liÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡u",
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
    logMessage: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i signIn",
    serverMessage: "Loi he thong",
    validationMessage: "Loi xac thuc du lieu",
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
          "Google OAuth chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Â£c cÃƒÂ¡Ã‚ÂºÃ‚Â¥u hÃƒÆ’Ã‚Â¬nh Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚ÂºÃ‚Â§y Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã‚Â§.",
        ),
        { status: 500 },
      );
    }

    return getGoogleAuthUrl();
  },
  present: (location) => presentRedirect(location),
  onError: makeStatusMessageErrorHandler({
    logMessage: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i startGoogleAuth",
    fallbackMessage: "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ bÃƒÂ¡Ã‚ÂºÃ‚Â¯t Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚ÂºÃ‚Â§u Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p Google",
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
    logMessage: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i googleCallback",
    message: "Ãƒâ€žÃ‚ÂÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p Google thÃƒÂ¡Ã‚ÂºÃ‚Â¥t bÃƒÂ¡Ã‚ÂºÃ‚Â¡i",
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
    logMessage: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i verifyEmailCode",
    message: "XÃƒÆ’Ã‚Â¡c minh email thÃƒÂ¡Ã‚ÂºÃ‚Â¥t bÃƒÂ¡Ã‚ÂºÃ‚Â¡i",
  }),
});

export const resendVerificationCode = makeCommandHandler({
  execute: (req) =>
    resendEmailVerification({
      verificationToken: req.body?.verificationToken,
    }),
  present: presentCommandResult,
  onError: makeServerErrorHandler({
    logMessage: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i resendVerificationCode",
    message: "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ gÃƒÂ¡Ã‚Â»Ã‚Â­i lÃƒÂ¡Ã‚ÂºÃ‚Â¡i mÃƒÆ’Ã‚Â£ xÃƒÆ’Ã‚Â¡c minh",
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
    fallbackMessage: "Khong the xu ly yeu cau quen mat khau.",
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
    fallbackMessage: "Khong the xac minh ma dat lai mat khau.",
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
    fallbackMessage: "Khong the dat lai mat khau.",
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
    logMessage: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi gÃƒÂ¡Ã‚Â»Ã‚Âi signOut",
    message: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i hÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡ thÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœng",
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
    logMessage: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi gÃƒÂ¡Ã‚Â»Ã‚Âi refreshToken",
    message: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i hÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡ thÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœng",
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
    logMessage: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi gÃƒÂ¡Ã‚Â»Ã‚Âi changePassword",
    message: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i hÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡ thÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœng",
  }),
});

export const requestAccountDeletion = makeCommandHandler({
  execute: (req) =>
    requestAuthenticatedAccountDeletion({
      userId: req.user?._id,
    }),
  present: presentCommandResult,
  onError: makeServerErrorHandler({
    logMessage: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i requestAccountDeletion",
    message:
      "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ bÃƒÂ¡Ã‚ÂºÃ‚Â¯t Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚ÂºÃ‚Â§u yÃƒÆ’Ã‚Âªu cÃƒÂ¡Ã‚ÂºÃ‚Â§u xÃƒÆ’Ã‚Â³a tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n.",
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
    logMessage: "Loi confirmAccountDeletion",
    message: "Khong the xoa tai khoan.",
  }),
});
