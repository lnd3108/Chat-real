import crypto from "crypto";

export const generateNumericOtp = (length = 6) => {
  const digits = [];

  while (digits.length < length) {
    const value = crypto.randomInt(0, 10);
    digits.push(String(value));
  }

  return digits.join("");
};
