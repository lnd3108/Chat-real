const SENSITIVE_KEY_PATTERN =
  /password|hashedpassword|token|secret|otp|cookie|authorization|mail_pass|smtp|session/i;

export const maskEmail = (value) => {
  const email = String(value ?? "").trim();
  const atIndex = email.indexOf("@");

  if (atIndex <= 1) {
    return "[REDACTED_EMAIL]";
  }

  const name = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  return `${name.slice(0, 2)}***${domain}`;
};

const maskString = (value, key = "") => {
  if (!value) {
    return value;
  }

  if (/email/i.test(key)) {
    return maskEmail(value);
  }

  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return "[REDACTED]";
  }

  return String(value).length > 120 ? "[TRUNCATED]" : value;
};

export const maskSensitiveObject = (value, parentKey = "") => {
  if (value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveObject(item, parentKey));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key)
          ? "[REDACTED]"
          : maskSensitiveObject(entryValue, key),
      ]),
    );
  }

  if (typeof value === "string") {
    return maskString(value, parentKey);
  }

  return value;
};
