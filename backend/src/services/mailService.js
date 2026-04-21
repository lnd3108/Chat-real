import { sendPasswordResetOtpEmail } from "../utils/mail.js";

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
