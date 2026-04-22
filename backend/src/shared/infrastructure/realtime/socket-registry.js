let ioInstance = null;

export const setIo = (io) => {
  ioInstance = io;
  return ioInstance;
};

export const getIo = () => {
  if (!ioInstance) {
    throw new Error("Socket.io has not been initialized. Call initSocket(server) first.");
  }

  return ioInstance;
};

export const hasIo = () => Boolean(ioInstance);
