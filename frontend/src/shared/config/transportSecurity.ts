const isSecureHttpUrl = (value: string | undefined) => {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const isSecureSocketUrl = (value: string | undefined) => {
  if (!value) return false;
  try {
    return ["https:", "wss:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

export const validateFrontendTransportConfig = () => {
  if (!import.meta.env.PROD) {
    return;
  }

  if (!isSecureHttpUrl(import.meta.env.VITE_API_URL)) {
    throw new Error("Production VITE_API_URL must use HTTPS.");
  }

  if (
    import.meta.env.VITE_SOCKET_URL &&
    !isSecureSocketUrl(import.meta.env.VITE_SOCKET_URL)
  ) {
    throw new Error("Production VITE_SOCKET_URL must use HTTPS or WSS.");
  }
};
