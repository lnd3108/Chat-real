export const GROUP_CALL_SOCKET_EVENTS = {
  START: "group-call:start",
  JOIN: "group-call:join",
  DECLINE: "group-call:decline",
  LEAVE: "group-call:leave",
  END: "group-call:end",
  OFFER: "group-call:offer",
  ANSWER: "group-call:answer",
  ICE_CANDIDATE: "group-call:ice-candidate",
  SYNC_STATE: "group-call:sync-state",
  INCOMING: "group-call:incoming",
  STARTED: "group-call:started",
  PARTICIPANT_JOINED: "group-call:participant-joined",
  PARTICIPANT_LEFT: "group-call:participant-left",
  PARTICIPANT_DECLINED: "group-call:participant-declined",
  PARTICIPANT_MISSED: "group-call:participant-missed",
  ENDED: "group-call:ended",
  STATE: "group-call:state",
  BUSY: "group-call:busy",
  ERROR: "group-call:error",
} as const;

export const GROUP_CALL_STATUS = {
  IDLE: "idle",
  RINGING: "ringing",
  JOINING: "joining",
  CONNECTING: "connecting",
  ACTIVE: "active",
  ENDED: "ended",
  FAILED: "failed",
} as const;

export const GROUP_CALL_ERROR_MESSAGES: Record<string, string> = {
  GROUP_CALL_NOT_GROUP_CONVERSATION: "Chỉ hỗ trợ gọi thoại nhóm trong nhóm chat.",
  GROUP_CALL_FORBIDDEN: "Bạn không thể thực hiện cuộc gọi nhóm này.",
  GROUP_CALL_ALREADY_ACTIVE: "Nhóm đang có cuộc gọi thoại.",
  GROUP_CALL_USER_BUSY: "Bạn hoặc thành viên đang trong cuộc gọi khác.",
  GROUP_CALL_NOT_FOUND: "Không tìm thấy cuộc gọi nhóm.",
  GROUP_CALL_INVALID_STATE: "Trạng thái cuộc gọi nhóm không hợp lệ.",
  GROUP_CALL_NOT_PARTICIPANT: "Bạn không thuộc cuộc gọi nhóm này.",
  GROUP_CALL_PARTICIPANT_LIMIT_REACHED:
    "Cuộc gọi nhóm đã đạt giới hạn người tham gia.",
  GROUP_CALL_VIDEO_NOT_SUPPORTED: "Chưa hỗ trợ gọi video nhóm.",
  GROUP_CALL_SIGNALING_FORBIDDEN:
    "Bạn không có quyền gửi tín hiệu trong cuộc gọi nhóm này.",
};

export const GROUP_CALL_MIC_ERROR =
  "Không thể truy cập micro. Vui lòng kiểm tra quyền trình duyệt.";
