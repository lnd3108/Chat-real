const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|cookie|otp|authorization|refresh|access)/i;

export const maskEmail = (value: unknown) => {
  if (typeof value !== "string" || !value.includes("@")) {
    return value;
  }

  const [name, domain] = value.split("@");
  if (!name || !domain) {
    return value;
  }

  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(name.length - visible.length, 0))}@${domain}`;
};

export const maskSensitiveObject = (value: unknown, parentKey = ""): unknown => {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    if (SENSITIVE_KEY_PATTERN.test(parentKey)) {
      return "[REDACTED]";
    }

    if (parentKey.toLowerCase().includes("email")) {
      return maskEmail(value);
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveObject(item, parentKey));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key)
          ? "[REDACTED]"
          : maskSensitiveObject(item, key),
      ]),
    );
  }

  return value;
};
