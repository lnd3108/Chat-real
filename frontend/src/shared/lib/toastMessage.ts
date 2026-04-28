const MESSAGE_MAP: Record<string, string> = {
  "userName hoac Password khong chinh xac":
    "Tên tài khoản hoặc mật khẩu không chính xác.",
  "Email cua ban chua duoc xac minh. Chung toi da gui lai ma xac minh.":
    "Email của bạn chưa được xác minh. Chúng tôi đã gửi lại mã xác minh.",
  "Email cua ban chua duoc xac minh. Vui long tiep tuc xac minh truoc khi dang nhap.":
    "Email của bạn chưa được xác minh. Vui lòng tiếp tục xác minh trước khi đăng nhập.",
};

export const normalizeToastMessage = (message?: string | null) => {
  if (!message) return "";

  const trimmedMessage = message.trim();
  return MESSAGE_MAP[trimmedMessage] ?? trimmedMessage;
};
