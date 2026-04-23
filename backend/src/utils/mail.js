import nodemailer from "nodemailer";
import { getMailConfig } from "../config/mail.js";

let transporter;

const isPlaceholder = (value) =>
  typeof value === "string" &&
  (value.includes("your_gmail@gmail.com") ||
    value.includes("your_google_app_password"));

const isMailConfigured = () => {
  const config = getMailConfig();

  return Boolean(
    config.host &&
      config.port &&
      config.user &&
      config.pass &&
      config.from &&
      !isPlaceholder(config.user) &&
      !isPlaceholder(config.pass) &&
      !isPlaceholder(config.from),
  );
};

const getTransporter = () => {
  if (!isMailConfigured()) {
    throw new Error("SMTP chưa được cấu hình đầy đủ");
  }

  if (!transporter) {
    const config = getMailConfig();

    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  return transporter;
};

const getAppName = () => process.env.APP_NAME || "ChatRealTime";

const normalizeRecipients = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const sendMail = async ({ to, subject, text, html }) => {
  if (!isMailConfigured()) {
    throw new Error("SMTP not configured. Please set mail environment variables.");
  }

  const mailer = getTransporter();
  const config = getMailConfig();
  const recipients = normalizeRecipients(to);

  try {
    const info = await mailer.sendMail({
      from: config.from,
      to,
      subject,
      text,
      html,
    });

    const rejectedRecipients = [
      ...(Array.isArray(info.rejected) ? info.rejected : []),
      ...(Array.isArray(info.pending) ? info.pending : []),
    ]
      .map((item) => String(item || "").trim())
      .filter(Boolean);

    if (rejectedRecipients.length > 0) {
      const error = new Error(
        `SMTP rejected recipient(s): ${rejectedRecipients.join(", ")}`,
      );
      error.code = "SMTP_RECIPIENT_REJECTED";
      error.rejectedRecipients = rejectedRecipients;
      throw error;
    }

    console.log("Mail sent:", {
      to: recipients,
      accepted: Array.isArray(info.accepted) ? info.accepted : [],
      response: info.response,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("Error sending mail:", {
      to: recipients,
      subject,
      error: error.message,
      code: error.code,
      rejectedRecipients: error.rejectedRecipients || [],
    });
    throw error;
  }
};

export const sendVerificationCodeEmail = async ({
  email,
  code,
  displayName,
}) => {
  const appName = getAppName();

  await sendMail({
    to: email,
    subject: `${appName} - Mã xác minh email`,
    text: [
      `Xin chào ${displayName || "bạn"},`,
      "",
      `Mã xác minh của bạn là: ${code}`,
      "",
      "Mã có hiệu lực trong 10 phút.",
      "Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email này.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2 style="margin-bottom:12px">${appName}</h2>
        <p>Xin chào ${displayName || "bạn"},</p>
        <p>Mã xác minh của bạn là:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:20px 0">${code}</p>
        <p>Mã có hiệu lực trong <strong>10 phút</strong>.</p>
        <p>Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email này.</p>
      </div>
    `,
  });
};

export const sendPasswordResetOtpEmail = async ({
  email,
  code,
  displayName,
}) => {
  const appName = getAppName();

  await sendMail({
    to: email,
    subject: `${appName} - Xác nhận quên mật khẩu`,
    text: [
      `Xin chào ${displayName || "bạn"},`,
      "",
      `Mã xác nhận của bạn là: ${code}`,
      "",
      "Mã có hiệu lực trong 5 phút.",
      "Không chia sẻ mã này cho bất kỳ ai.",
      "Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2 style="margin-bottom:12px">${appName}</h2>
        <p>Xin chào ${displayName || "bạn"},</p>
        <p>Mã xác nhận của bạn là:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:20px 0">${code}</p>
        <p>Mã có hiệu lực trong <strong>5 phút</strong>.</p>
        <p><strong>Không chia sẻ mã này cho bất kỳ ai.</strong></p>
        <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
      </div>
    `,
  });
};

export const sendEmailChangeVerificationEmail = async ({
  email,
  code,
  displayName,
}) => {
  const appName = getAppName();

  await sendMail({
    to: email,
    subject: `${appName} - Xác minh email mới`,
    text: [
      `Xin chào ${displayName || "bạn"},`,
      "",
      `Bạn đang yêu cầu đổi email cho tài khoản ${appName}.`,
      `Mã xác minh của bạn là: ${code}`,
      "",
      "Mã có hiệu lực trong 5 phút.",
      "Nếu không phải bạn, hãy bỏ qua email này.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2 style="margin-bottom:12px">${appName}</h2>
        <p>Xin chào ${displayName || "bạn"},</p>
        <p>Bạn đang yêu cầu đổi email cho tài khoản ${appName}.</p>
        <p>Mã xác minh của bạn là:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:20px 0">${code}</p>
        <p>Mã có hiệu lực trong <strong>5 phút</strong>.</p>
        <p>Nếu không phải bạn, hãy bỏ qua email này.</p>
      </div>
    `,
  });
};

export const sendAccountDeletionCodeEmail = async ({
  email,
  code,
  displayName,
}) => {
  const appName = getAppName();

  await sendMail({
    to: email,
    subject: `${appName} - Mã xác minh xóa tài khoản`,
    text: [
      `Xin chào ${displayName || "bạn"},`,
      "",
      `Mã xác minh xóa tài khoản của bạn là: ${code}`,
      "",
      "Mã có hiệu lực trong 5 phút.",
      "Nếu bạn không yêu cầu xóa tài khoản, vui lòng đổi mật khẩu và bỏ qua email này.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2 style="margin-bottom:12px">${appName}</h2>
        <p>Xin chào ${displayName || "bạn"},</p>
        <p>Mã xác minh xóa tài khoản của bạn là:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:20px 0">${code}</p>
        <p>Mã có hiệu lực trong <strong>5 phút</strong>.</p>
        <p>Nếu bạn không yêu cầu xóa tài khoản, vui lòng đổi mật khẩu và bỏ qua email này.</p>
      </div>
    `,
  });
};

export const sendAccountDeletedEmail = async ({
  email,
  displayName,
  deletedByAdmin = false,
  reason = null,
}) => {
  const appName = getAppName();
  const trimmedReason =
    typeof reason === "string" && reason.trim() ? reason.trim() : null;
  const deletionMessage = deletedByAdmin
    ? "Tài khoản ChatRealTime của bạn đã bị quản trị viên xóa."
    : "Tài khoản ChatRealTime của bạn đã được xóa thành công.";
  const supportMessage = deletedByAdmin
    ? "Nếu bạn cần thêm thông tin, vui lòng liên hệ đội ngũ hỗ trợ."
    : "Nếu đây không phải là thao tác của bạn, vui lòng liên hệ hỗ trợ ngay lập tức.";
  const reasonText = trimmedReason
    ? `Lý do từ quản trị viên: ${trimmedReason}`
    : null;
  const reasonHtml = trimmedReason
    ? `<p><strong>Lý do từ quản trị viên:</strong> ${trimmedReason}</p>`
    : "";
  const config = getMailConfig();

  await sendMail({
    to: email,
    subject: deletedByAdmin
      ? `${appName} - Tài khoản của bạn đã bị xóa bởi quản trị viên`
      : `${appName} - Tài khoản đã được xóa`,
    text: [
      `Xin chào ${displayName || "bạn"},`,
      "",
      deletionMessage,
      ...(reasonText ? ["", reasonText] : []),
      "",
      supportMessage,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2 style="margin-bottom:12px">${appName}</h2>
        <p>Xin chào ${displayName || "bạn"},</p>
        <p>${deletionMessage}</p>
        ${reasonHtml}
        <p>${supportMessage}</p>
        <p>Email liên hệ: ${config.user}</p>
      </div>
    `,
  });
};

export const sendMaintenanceConfirmationCodeEmail = async ({ email, code }) => {
  const appName = getAppName();

  await sendMail({
    to: email,
    subject: `${appName} - Mã xác nhận bảo trì hệ thống`,
    text: [
      "Xin chào Quản trị viên,",
      "",
      `Mã xác nhận bảo trì hệ thống của bạn là: ${code}`,
      "",
      "Mã có hiệu lực trong 10 phút.",
      "Nếu bạn không yêu cầu bảo trì hệ thống, vui lòng bỏ qua email này.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2 style="margin-bottom:12px">${appName}</h2>
        <p>Xin chào Quản trị viên,</p>
        <p>Mã xác nhận bảo trì hệ thống của bạn là:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:20px 0">${code}</p>
        <p>Mã có hiệu lực trong <strong>10 phút</strong>.</p>
        <p>Nếu bạn không yêu cầu bảo trì hệ thống, vui lòng bỏ qua email này.</p>
      </div>
    `,
  });
};

const getMailConfigStatus = () => {
  const config = getMailConfig();

  if (!config.host || !config.port) {
    return {
      ok: false,
      message: "Thiếu SMTP_HOST hoặc SMTP_PORT.",
    };
  }

  if (!config.user || !config.pass || !config.from) {
    return {
      ok: false,
      message: "Thiếu MAIL_USER/MAIL_PASS/MAIL_FROM hoặc SMTP_USER/SMTP_PASS/SMTP_FROM.",
    };
  }

  if (isPlaceholder(config.user) || isPlaceholder(config.pass) || isPlaceholder(config.from)) {
    return {
      ok: false,
      message: "Cấu hình email vẫn đang dùng giá trị mẫu, chưa thay bằng tài khoản thật.",
    };
  }

  return {
    ok: true,
    message: `Email đã cấu hình cho ${config.user}.`,
  };
};

export { getMailConfigStatus, isMailConfigured };
