import { getIo, hasIo } from "./socket-registry.js";

export const emitToUser = (userId, eventName, payload) => {
  if (!hasIo() || !userId || !eventName) {
    return;
  }

  getIo().to(userId.toString()).emit(eventName, payload);
};

export const emitToRoom = (roomId, eventName, payload) => {
  if (!hasIo() || !roomId || !eventName) {
    return;
  }

  getIo().to(roomId.toString()).emit(eventName, payload);
};

export const emitGlobal = (eventName, payload) => {
  if (!hasIo() || !eventName) {
    return;
  }

  getIo().emit(eventName, payload);
};
