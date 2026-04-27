// Cấu hình mail server
export const getMailConfig = () => ({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure:
    String(
      process.env.SMTP_SECURE ??
        (Number(process.env.SMTP_PORT || 587) === 465 ? "true" : "false"),
    ).toLowerCase() === "true",
  user: process.env.MAIL_USER || process.env.SMTP_USER,
  pass: process.env.MAIL_PASS || process.env.SMTP_PASS,
  from: process.env.MAIL_FROM || process.env.SMTP_FROM,
});
