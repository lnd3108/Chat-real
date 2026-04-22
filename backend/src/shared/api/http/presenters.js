export const presentJson = ({ status = 200, body }) => ({
  type: "json",
  status,
  body,
});

export const presentError = (status, message, extra = {}) =>
  presentJson({
    status,
    body: {
      success: false,
      statusCode: status,
      message,
      ...extra,
    },
  });

export const presentNoContent = () => ({
  type: "sendStatus",
  status: 204,
});

export const presentRedirect = (location, status = 302) => ({
  type: "redirect",
  status,
  location,
});

export const presentCommandResult = (result) => {
  if (result?.sendStatus) {
    return {
      type: "sendStatus",
      status: result.sendStatus,
    };
  }

  if (result?.error) {
    return {
      type: "json",
      status: result.error.status,
      body: {
        message: result.error.message,
        ...(result.error.code ? { code: result.error.code } : {}),
      },
    };
  }

  return presentJson({
    status: result.status,
    body: result.payload ?? result.body,
  });
};

export const presentSuccessData = (data, status = 200) =>
  presentJson({
    status,
    body: {
      success: true,
      data,
    },
  });

export const presentMessageData = (message, data, status = 200) =>
  presentJson({
    status,
    body: {
      message,
      data,
    },
  });

export const presentSuccessMessage = (message, data = null, status = 200) =>
  presentJson({
    status,
    body: data === null
      ? { success: true, message }
      : { success: true, message, data },
  });
