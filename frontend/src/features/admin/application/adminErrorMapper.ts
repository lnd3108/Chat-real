import axios from "axios";
import { getErrorMessage } from "@/shared/lib/httpError";

export const getAdminErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) && typeof error.response?.data?.message === "string"
    ? error.response.data.message
    : getErrorMessage(error, fallback);
