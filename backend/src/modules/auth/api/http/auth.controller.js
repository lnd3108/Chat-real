import { signInSchema, signUpSchema } from "../../../../libs/validation.js";
import { logger } from "../../../../utils/logger.js";
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

const sendResult = (res, result) => {
  if (result?.sendStatus) {
    return res.sendStatus(result.sendStatus);
  }

  return res.status(result.status).json(result.body);
};

export const signUp = async (req, res) => {
  try {
    const validatedData = signUpSchema.parse(req.body);
    const result = await signUpUser(validatedData);
    return sendResult(res, result);
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "LÃ¡Â»â€”i xÃƒÂ¡c thÃ¡Â»Â±c dÃ¡Â»Â¯ liÃ¡Â»â€¡u",
        errors: error.issues || error.errors,
      });
    }

    logger.error("LÃ¡Â»â€”i khi gÃ¡Â»Âi signUp", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "LÃ¡Â»â€”i hÃ¡Â»â€¡ thÃ¡Â»â€˜ng" });
  }
};

export const signIn = async (req, res) => {
  try {
    const validatedData = signInSchema.parse(req.body);
    const result = await signInUser({ ...validatedData, res });
    return sendResult(res, result);
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Loi xac thuc du lieu",
        errors: error.issues || error.errors,
      });
    }

    logger.error("LÃ¡Â»â€”i signIn", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const startGoogleAuth = async (_req, res) => {
  try {
    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GOOGLE_CALLBACK_URL
    ) {
      return res.status(500).json({
        message: "Google OAuth chÃ†Â°a Ã„â€˜Ã†Â°Ã¡Â»Â£c cÃ¡ÂºÂ¥u hÃƒÂ¬nh Ã„â€˜Ã¡ÂºÂ§y Ã„â€˜Ã¡Â»Â§.",
      });
    }

    return res.redirect(getGoogleAuthUrl());
  } catch (error) {
    logger.error("LÃ¡Â»â€”i startGoogleAuth", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "KhÃƒÂ´ng thÃ¡Â»Æ’ bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u Ã„â€˜Ã„Æ’ng nhÃ¡ÂºÂ­p Google" });
  }
};

export const googleCallback = async (req, res) => {
  try {
    const result = await signInWithGoogle({
      code: req.body?.code,
      res,
    });
    return sendResult(res, result);
  } catch (error) {
    logger.error("LÃ¡Â»â€”i googleCallback", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "Ã„ÂÃ„Æ’ng nhÃ¡ÂºÂ­p Google thÃ¡ÂºÂ¥t bÃ¡ÂºÂ¡i" });
  }
};

export const verifyEmailCode = async (req, res) => {
  try {
    const result = await verifyEmailWithCode({
      verificationToken: req.body?.verificationToken,
      code: req.body?.code,
      res,
    });
    return sendResult(res, result);
  } catch (error) {
    logger.error("LÃ¡Â»â€”i verifyEmailCode", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "XÃƒÂ¡c minh email thÃ¡ÂºÂ¥t bÃ¡ÂºÂ¡i" });
  }
};

export const resendVerificationCode = async (req, res) => {
  try {
    const result = await resendEmailVerification({
      verificationToken: req.body?.verificationToken,
    });
    return sendResult(res, result);
  } catch (error) {
    logger.error("LÃ¡Â»â€”i resendVerificationCode", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "KhÃƒÂ´ng thÃ¡Â»Æ’ gÃ¡Â»Â­i lÃ¡ÂºÂ¡i mÃƒÂ£ xÃƒÂ¡c minh" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const payload = await requestPasswordReset({
      email: req.body?.email,
      req,
    });

    return res.status(200).json(payload);
  } catch (error) {
    logger.warn("Loi forgotPassword", {
      message: error?.message,
      status: error?.status,
    });

    return res.status(error?.status || 500).json({
      message: error?.message || "Khong the xu ly yeu cau quen mat khau.",
      resendAvailableAt: error?.resendAvailableAt,
      attemptsRemaining: error?.attemptsRemaining,
    });
  }
};

export const verifyForgotPasswordOtp = async (req, res) => {
  try {
    const payload = await verifyPasswordResetOtp({
      email: req.body?.email,
      otp: req.body?.otp,
    });

    return res.status(200).json(payload);
  } catch (error) {
    logger.warn("Loi verifyForgotPasswordOtp", {
      message: error?.message,
      status: error?.status,
    });

    return res.status(error?.status || 500).json({
      message: error?.message || "Khong the xac minh ma dat lai mat khau.",
      attemptsRemaining: error?.attemptsRemaining,
    });
  }
};

export const resetForgottenPassword = async (req, res) => {
  try {
    const payload = await resetPasswordWithVerifiedOtp({
      email: req.body?.email,
      resetToken: req.body?.resetToken,
      resetTokenValue: req.body?.resetTokenValue,
      newPassword: req.body?.newPassword,
      confirmPassword: req.body?.confirmPassword,
    });

    res.clearCookie("refreshToken");
    res.clearCookie("accessToken");

    return res.status(200).json(payload);
  } catch (error) {
    logger.warn("Loi resetForgottenPassword", {
      message: error?.message,
      status: error?.status,
    });

    return res.status(error?.status || 500).json({
      message: error?.message || "Khong the dat lai mat khau.",
    });
  }
};

export const signOut = async (req, res) => {
  try {
    const result = await signOutUser({
      cookies: req.cookies,
      authorizationHeader: req.headers.authorization,
      res,
    });
    return sendResult(res, result);
  } catch (error) {
    logger.error("LÃ¡Â»â€”i khi gÃ¡Â»Âi signOut", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({
      message: "LÃ¡Â»â€”i hÃ¡Â»â€¡ thÃ¡Â»â€˜ng",
    });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const result = await refreshAccessToken({
      refreshToken: req.cookies?.refreshToken,
      res,
    });
    return sendResult(res, result);
  } catch (error) {
    logger.error("LÃ¡Â»â€”i khi gÃ¡Â»Âi refreshToken", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({
      message: "LÃ¡Â»â€”i hÃ¡Â»â€¡ thÃ¡Â»â€˜ng",
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const result = await changePasswordForUser({
      userId: req.user?._id,
      currentPassword: req.body?.currentPassword,
      newPassword: req.body?.newPassword,
      confirmPassword: req.body?.confirmPassword,
      res,
    });
    return sendResult(res, result);
  } catch (error) {
    logger.error("LÃ¡Â»â€”i khi gÃ¡Â»Âi changePassword", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: "LÃ¡Â»â€”i hÃ¡Â»â€¡ thÃ¡Â»â€˜ng" });
  }
};

export const requestAccountDeletion = async (req, res) => {
  try {
    const result = await requestAuthenticatedAccountDeletion({
      userId: req.user?._id,
    });
    return sendResult(res, result);
  } catch (error) {
    logger.error("LÃ¡Â»â€”i requestAccountDeletion", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({
      message: "KhÃƒÂ´ng thÃ¡Â»Æ’ bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u yÃƒÂªu cÃ¡ÂºÂ§u xÃƒÂ³a tÃƒÂ i khoÃ¡ÂºÂ£n.",
    });
  }
};

export const confirmAccountDeletion = async (req, res) =>
  sendResult(
    res,
    await confirmAuthenticatedAccountDeletion({
      user: req.user,
      body: req.body,
      res,
    }),
  );
