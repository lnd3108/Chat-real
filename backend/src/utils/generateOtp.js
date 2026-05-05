import crypto from "crypto";
import { getMockOtpCode } from "./loadTestGuard.js";

export const generateNumericOtp = (length = 6) => {
  const mockOtp = getMockOtpCode(length);
  if (mockOtp) {
    return mockOtp;
  }

  const digits = [];

  while (digits.length < length) {
    const value = crypto.randomInt(0, 10);
    digits.push(String(value));
  }

  return digits.join("");
};
