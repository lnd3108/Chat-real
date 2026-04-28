import api from "@/shared/api/axios";

export type CreateReportPayload = {
  targetType: "user" | "message" | "conversation";
  targetUserId?: string;
  targetMessageId?: string;
  targetConversationId?: string;
  reason: string;
  description?: string;
};

export const reportService = {
  createReport: async (payload: CreateReportPayload) => {
    const response = await api.post("/reports", payload);
    return response.data;
  },
};
