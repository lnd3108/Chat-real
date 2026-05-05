import { maskSensitiveObject } from "./maskSensitiveData.js";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export const isTruthyEnv = (value) =>
  TRUE_VALUES.has(String(value ?? "").trim().toLowerCase());

export const isLoadTestMode = () => isTruthyEnv(process.env.LOAD_TEST);

export const assertLoadTestIsNotProduction = () => {
  if (isLoadTestMode() && process.env.NODE_ENV === "production") {
    throw new Error("LOAD_TEST=true is not allowed with NODE_ENV=production.");
  }
};

export const shouldDisableExternalSideEffects = () =>
  isLoadTestMode() || isTruthyEnv(process.env.DISABLE_EMAIL);

export const getMockOtpCode = (length = 6) => {
  if (!isLoadTestMode()) {
    return null;
  }

  const mockOtp = String(process.env.MOCK_OTP ?? "").trim();
  const expectedPattern = new RegExp(`^\\d{${length}}$`);
  return expectedPattern.test(mockOtp) ? mockOtp : null;
};

export const maskLoadTestSensitiveData = (value) => maskSensitiveObject(value);
