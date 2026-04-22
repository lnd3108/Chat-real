import {
  sendError,
  sendJson,
  sendServerError,
} from "../../../utils/controllerResponses.js";
import { logger } from "../../infrastructure/logger/logger.js";

export const makeServerErrorHandler = ({
  logMessage,
  message = "Loi he thong",
  status = 500,
  extra = {},
}) => (error, _req, res) =>
  sendServerError(res, error, {
    logMessage,
    message,
    status,
    extra,
  });

export const makeStatusMessageErrorHandler = ({
  logMessage = null,
  fallbackMessage,
  extraKeys = [],
}) => (error, _req, res) => {
  if (logMessage && !error?.status) {
    return sendServerError(res, error, {
      logMessage,
      message: fallbackMessage,
      status: 500,
    });
  }

  const payload = {
    message: error?.message || fallbackMessage,
  };

  for (const key of extraKeys) {
    if (error?.[key] !== undefined) {
      payload[key] = error[key];
    }
  }

  return sendJson(res, error?.status || 500, payload);
};

export const makeSuccessFlagErrorHandler = ({
  logMessage = null,
  fallbackMessage,
  extraKeys = [],
}) => (error, _req, res) => {
  if (logMessage && !error?.status) {
    return sendServerError(res, error, {
      logMessage,
      message: fallbackMessage,
      extra: { success: false },
    });
  }

  const payload = {
    success: false,
    message: error?.message || fallbackMessage,
  };

  for (const key of extraKeys) {
    if (error?.[key] !== undefined) {
      payload[key] = error[key];
    }
  }

  return sendJson(res, error?.status || 500, payload);
};

export const makeStatusAwareErrorHandler = ({
  logMessage,
  message,
}) => (error, _req, res) =>
  error?.status
    ? sendError(res, error.status, error.message)
    : sendServerError(res, error, { logMessage, message });

export const makePayloadErrorHandler = ({
  logMessage = null,
  fallbackMessage = "Loi he thong",
}) => (error, _req, res) => {
  if (logMessage && !error?.payload) {
    return sendServerError(res, error, {
      logMessage,
      message: fallbackMessage,
      status: error?.status || 500,
    });
  }

  return sendJson(
    res,
    error?.status || 500,
    error?.payload || { message: error?.message || fallbackMessage },
  );
};

export const makeJsonErrorHandler = ({
  logMessage = null,
  status = 500,
  buildBody,
}) => (error, _req, res) => {
  if (logMessage) {
    logger.error(logMessage, {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      status: error?.status,
    });
  }

  return sendJson(res, status, buildBody(error));
};

export const makeValidationErrorHandler = ({
  logMessage,
  serverMessage,
  validationMessage,
}) => (error, _req, res) => {
  if (error?.name === "ZodError") {
    return sendJson(res, 400, {
      message: validationMessage,
      errors: error.issues || error.errors,
    });
  }

  return sendServerError(res, error, {
    logMessage,
    message: serverMessage,
  });
};
