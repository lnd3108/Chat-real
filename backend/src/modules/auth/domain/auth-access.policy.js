export const isUserBanned = (user) => user?.status === "banned";

// thông báo khi tài khoản bị khóa
export const buildBannedResponse = () => ({
  code: "ACCOUNT_BANNED",
  message: "Tài khoản của bạn đã bị khóa.",
});
