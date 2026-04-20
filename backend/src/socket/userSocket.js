import { emitToUser } from "./index.js";

export const emitUserSocketEvent = (userId, eventName, payload) => {
  emitToUser(userId, eventName, payload);
};
