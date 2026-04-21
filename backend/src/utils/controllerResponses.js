import { logger } from "./logger.js";

export const sendError = (res, status, message, extra = {}) =>
  res.status(status).json({
    success: false,
    statusCode: status,
    message,
    ...extra,
  });

export const sendServerError = (
  res,
  error,
  {
    logMessage,
    message = "Lỗi hệ thống",
    status = 500,
    extra = {},
  } = {},
) => {
  if (logMessage) {
    logger.error(logMessage, {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      status: error?.status,
    });
  }

  return sendError(res, status, message, extra);
};
