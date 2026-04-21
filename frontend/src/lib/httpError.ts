import axios from "axios";

type ApiErrorPayload = {
  message?: unknown;
};

type ApiErrorResponse = {
  data?: ApiErrorPayload;
  status?: number;
};

type ApiErrorLike = {
  response?: ApiErrorResponse;
  message?: unknown;
  name?: unknown;
};

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as ApiErrorLike).message === "string" &&
    (error as ApiErrorLike).message?.trim()
  ) {
    return (error as ApiErrorLike).message as string;
  }

  return fallback;
};

export const getErrorStatus = (error: unknown): number | null => {
  if (axios.isAxiosError(error) && typeof error.response?.status === "number") {
    return error.response.status;
  }

  return null;
};

export const isAbortLikeError = (error: unknown): boolean => {
  if (axios.isAxiosError(error)) {
    return error.code === "ERR_CANCELED";
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    ((error as ApiErrorLike).name === "AbortError" ||
      (error as ApiErrorLike).name === "CanceledError")
  );
};
