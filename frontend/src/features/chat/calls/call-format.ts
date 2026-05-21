export const formatCallDuration = (seconds?: number | null) => {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remain = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
};

export const getCallHistoryLabel = ({
  callType,
  callMode,
  callStatus,
  durationSeconds,
}: {
  callType?: "voice" | "video" | string | null;
  callMode?: "direct" | "group" | string | null;
  callStatus?: string | null;
  durationSeconds?: number | null;
}) => {
  const label =
    callMode === "group"
      ? "Cuộc gọi thoại nhóm"
      : callType === "video"
        ? "Cuộc gọi video"
        : "Cuộc gọi thoại";

  switch (callStatus) {
    case "ended":
      return durationSeconds && durationSeconds > 0
        ? `${label} đã kết thúc (${formatCallDuration(durationSeconds)})`
        : `${label} đã kết thúc`;
    case "rejected":
      return `${label} bị từ chối`;
    case "cancelled":
      return `${label} đã hủy`;
    case "missed":
      return `${label} nhỡ`;
    case "failed":
      return `${label} thất bại`;
    default:
      return label;
  }
};
