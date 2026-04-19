import { Server } from "socket.io";

import { getUserConversationsForSocketIO } from "../controllers/conversationController.js";
import { socketAuthMiddleWare } from "../middlewares/socketMiddleWare.js";
import User from "../models/User.js";

let io;

const socketsByUser = new Map(); // { userId: Set(socketId) }
const visibleByUser = new Map(); // { userId: boolean }
const activeConversationBySocket = new Map(); // { socketId: conversationId | null }

export const initSocket = (server) => {
  io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL, credentials: true },
  });

  io.use(socketAuthMiddleWare);

  const emitOnlineUsers = () => {
    const onlineVisibleUsers = [];

    for (const [userId, socketIds] of socketsByUser.entries()) {
      const visible = visibleByUser.get(userId) ?? true;
      if (socketIds.size > 0 && visible) {
        onlineVisibleUsers.push(userId);
      }
    }

    io.emit("online-users", onlineVisibleUsers);
  };

  io.on("connection", async (socket) => {
    const user = socket.user;
    const userId = user._id.toString();

    let visible = user?.preferences?.showOnlineStatus;
    if (typeof visible !== "boolean") {
      const dbUser = await User.findById(userId).select(
        "preferences.showOnlineStatus",
      );
      visible = dbUser?.preferences?.showOnlineStatus;
    }

    if (typeof visible !== "boolean") {
      visible = true;
    }

    if (!socketsByUser.has(userId)) {
      socketsByUser.set(userId, new Set());
    }

    socketsByUser.get(userId).add(socket.id);
    visibleByUser.set(userId, visible);
    activeConversationBySocket.set(socket.id, null);

    emitOnlineUsers();

    socket.join(userId);
    const conversations = await getUserConversationsForSocketIO(user._id);
    conversations.forEach((id) => socket.join(id.toString()));

    socket.on("disconnect", () => {
      const socketIds = socketsByUser.get(userId);
      if (socketIds) {
        socketIds.delete(socket.id);

        if (socketIds.size === 0) {
          socketsByUser.delete(userId);
        }
      }

      activeConversationBySocket.delete(socket.id);
      emitOnlineUsers();
      console.log(`socket disconnect: ${socket.id}`);
    });

    socket.on("join-conversation", (conversationId) => {
      socket.join(conversationId);
    });

    socket.on("leave-conversation", (conversationId) => {
      socket.leave(conversationId);
    });

    socket.on("conversation:active", (conversationId) => {
      activeConversationBySocket.set(
        socket.id,
        typeof conversationId === "string" && conversationId.trim()
          ? conversationId
          : null,
      );
    });

    socket.on("preferences:showOnlineStatus", (value) => {
      if (typeof value === "boolean") {
        visibleByUser.set(userId, value);
        emitOnlineUsers();
      }
    });
  });

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io chưa được khởi tạo. Gọi initSocket(server) trước.");
  }

  return io;
};

export const emitToUser = (userId, eventName, payload) => {
  if (!io || !userId || !eventName) {
    return;
  }

  io.to(userId.toString()).emit(eventName, payload);
};

export const isConversationActiveForUser = (userId, conversationId) => {
  const socketIds = socketsByUser.get(userId?.toString());
  if (!socketIds || socketIds.size === 0 || !conversationId) {
    return false;
  }

  for (const socketId of socketIds) {
    if (activeConversationBySocket.get(socketId) === conversationId.toString()) {
      return true;
    }
  }

  return false;
};
