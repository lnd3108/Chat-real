export const CALL_SOCKET_EVENTS = {
  INVITE: "call:invite",
  ACCEPT: "call:accept",
  REJECT: "call:reject",
  CANCEL: "call:cancel",
  END: "call:end",
  OFFER: "call:offer",
  ANSWER: "call:answer",
  ICE_CANDIDATE: "call:ice-candidate",
  INCOMING: "call:incoming",
  ACCEPTED: "call:accepted",
  REJECTED: "call:rejected",
  CANCELLED: "call:cancelled",
  ENDED: "call:ended",
  MISSED: "call:missed",
  BUSY: "call:busy",
  ERROR: "call:error",
} as const;

export const CALL_STATUS = {
  IDLE: "idle",
  RINGING: "ringing",
  ACCEPTED: "accepted",
  CONNECTING: "connecting",
  ACTIVE: "active",
  REJECTED: "rejected",
  MISSED: "missed",
  CANCELLED: "cancelled",
  ENDED: "ended",
  FAILED: "failed",
} as const;

export const CALL_ERROR_MESSAGES: Record<string, string> = {
  CALL_NOT_DIRECT_CONVERSATION: "Chỉ hỗ trợ gọi trong chat 1-1.",
  CALL_CONVERSATION_NOT_FOUND: "Không tìm thấy cuộc trò chuyện.",
  CALL_FORBIDDEN: "Bạn không thể thực hiện cuộc gọi này.",
  CALL_BLOCKED: "Không thể gọi do một trong hai bên đã chặn bên còn lại.",
  CALL_RECEIVER_OFFLINE: "Người nhận đang ngoại tuyến.",
  CALL_USER_BUSY: "Người dùng đang trong cuộc gọi khác.",
  CALL_NOT_FOUND: "Không tìm thấy cuộc gọi.",
  CALL_INVALID_STATE: "Trạng thái cuộc gọi không hợp lệ.",
  CALL_SIGNALING_FORBIDDEN: "Bạn không có quyền gửi tín hiệu cuộc gọi.",
};

export const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];
