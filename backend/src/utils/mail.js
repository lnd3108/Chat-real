import nodemailer from "nodemailer";

let transporter;

const isPlaceholder = (value) =>
  typeof value === "string" &&
  (value.includes("your_gmail@gmail.com") ||
    value.includes("your_google_app_password"));

const isMailConfigured = () =>
  Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM &&
    !isPlaceholder(process.env.SMTP_USER) &&
    !isPlaceholder(process.env.SMTP_PASS) &&
    !isPlaceholder(process.env.SMTP_FROM),
  );

const getTransporter = () => {
  if (!isMailConfigured()) {
    throw new Error("SMTP chưa được cấu hình đầy đủ");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return transporter;
};

const getAppName = () => process.env.APP_NAME || "ChatRealTime";

const sendMail = async ({ to, subject, text, html }) => {
  const mailer = getTransporter();

  await mailer.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
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

export const sendAccountDeletedEmail = async ({ email, displayName }) => {
  const appName = getAppName();

  await sendMail({
    to: email,
    subject: `${appName} - Tài khoản đã được xóa`,
    text: [
      `Xin chào ${displayName || "bạn"},`,
      "",
      "Tài khoản ChatRealTime của bạn đã được xóa thành công.",
      "Nếu đây không phải là thao tác của bạn, vui lòng liên hệ hỗ trợ ngay lập tức.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2 style="margin-bottom:12px">${appName}</h2>
        <p>Xin chào ${displayName || "bạn"},</p>
        <p>Tài khoản ChatRealTime của bạn đã được xóa thành công.</p>
        <p>Nếu đây không phải là thao tác của bạn, vui lòng liên hệ hỗ trợ ngay lập tức.</p>
        <p>Email: ${email}, liên hệ để được hỗ trợ sớm nhất</p>
      </div>
    `,
  });
};

const getMailConfigStatus = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT) {
    return {
      ok: false,
      message: "Thiếu SMTP_HOST hoặc SMTP_PORT.",
    };
  }

  if (
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS ||
    !process.env.SMTP_FROM
  ) {
    return {
      ok: false,
      message: "Thiếu SMTP_USER, SMTP_PASS hoặc SMTP_FROM.",
    };
  }

  if (
    isPlaceholder(process.env.SMTP_USER) ||
    isPlaceholder(process.env.SMTP_PASS) ||
    isPlaceholder(process.env.SMTP_FROM)
  ) {
    return {
      ok: false,
      message:
        "SMTP vẫn đang dùng giá trị mẫu, chưa thay thế bằng tài khoản thật.",
    };
  }

  return {
    ok: true,
    message: `SMTP đã cấu hình cho ${process.env.SMTP_USER}.`,
  };
};

export { getMailConfigStatus, isMailConfigured };
