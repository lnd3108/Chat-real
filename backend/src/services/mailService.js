import { sendPasswordResetOtpEmail } from "../utils/mail.js";
import { sendEmailChangeVerificationEmail } from "../utils/mail.js";

export const sendForgotPasswordOtpEmail = async ({
  email,
  code,
  displayName,
}) =>
  sendPasswordResetOtpEmail({
    email,
    code,
    displayName,
  });

export const sendEmailChangeOtpEmail = async ({
  email,
  code,
  displayName,
}) =>
  sendEmailChangeVerificationEmail({
    email,
    code,
    displayName,
  });
