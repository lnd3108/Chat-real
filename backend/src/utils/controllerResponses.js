export const sendError = (res, status, message, extra = {}) =>
  res.status(status).json({
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
    console.error(logMessage, error);
  }

  return sendError(res, status, message, extra);
};
