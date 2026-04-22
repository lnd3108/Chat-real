import { logger } from "./logger.js";

export const sendJson = (res, status, payload) => res.status(status).json(payload);

export const sendSuccess = (res, payload, status = 200) =>
  sendJson(res, status, payload);

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

export const handleController = (handler, onError) => async (req, res) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return onError(error, req, res);
  }
};

export const respondCommandResult = (res, result) => {
  if (result?.error) {
    return res.status(result.error.status).json({
      message: result.error.message,
      code: result.error.code,
    });
  }

  return res.status(result.status).json(result.payload);
};
