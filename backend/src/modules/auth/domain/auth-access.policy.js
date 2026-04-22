export const isUserBanned = (user) => user?.status === "banned";

export const buildBannedResponse = () => ({
  code: "ACCOUNT_BANNED",
  message: "TÃƒÂ i khoÃ¡ÂºÂ£n cÃ¡Â»Â§a bÃ¡ÂºÂ¡n Ã„â€˜ÃƒÂ£ bÃ¡Â»â€¹ khÃƒÂ³a.",
});
