import {
  extractAccessTokenFromSocket,
  resolveAccessUserFromToken,
} from "../../application/resolve-access-user-from-token.js";

const createSocketAuthError = (message, code) => {
  const error = new Error(message);
  error.data = { code };
  return error;
};

export const socketAuthMiddleWare = async (socket, next) => {
  try {
    const result = await resolveAccessUserFromToken({
      token: extractAccessTokenFromSocket(socket),
      path: socket?.handshake?.url ?? "/socket.io",
    });

    if (!result.ok) {
      return next(createSocketAuthError(result.message, result.code));
    }

    socket.user = result.user;
    return next();
  } catch (error) {
    return next(createSocketAuthError("Khong the xac thuc socket", "TOKEN_INVALID"));
  }
};
