import { Server } from "socket.io";
import { socketAuthMiddleWare } from "../middlewares/socketMiddleWare.js";
import { getUserConversationsForSocketIO } from "../controllers/conversationController.js";
import User from "../models/User.js";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL, credentials: true },
  });

  io.use(socketAuthMiddleWare);

  // Presence thật: user mở bao nhiêu socket/tab
  const socketsByUser = new Map(); // { userId: Set(socketId) }

  // Preference: có cho người khác thấy online không
  const visibleByUser = new Map(); // { userId: boolean }

  const emitOnlineUsers = () => {
    const onlineVisibleUsers = [];
    for (const [userId, set] of socketsByUser.entries()) {
      const visible = visibleByUser.get(userId) ?? true;
      if (set.size > 0 && visible) onlineVisibleUsers.push(userId);
    }
    io.emit("online-users", onlineVisibleUsers);
  };

  io.on("connection", async (socket) => {
    const user = socket.user;
    const userId = user._id.toString();

    // ✅ Lấy preference thật (ưu tiên từ socket.user nếu có, fallback query DB)
    let visible = user?.preferences?.showOnlineStatus;
    if (typeof visible !== "boolean") {
      const dbUser = await User.findById(userId).select(
        "preferences.showOnlineStatus",
      );
      visible = dbUser?.preferences?.showOnlineStatus;
    }
    if (typeof visible !== "boolean") visible = true;

    // Track socket presence
    if (!socketsByUser.has(userId)) socketsByUser.set(userId, new Set());
    socketsByUser.get(userId).add(socket.id);

    // Track visibility preference
    visibleByUser.set(userId, visible);

    // ✅ Emit list online theo preference
    emitOnlineUsers();

    const conversations = await getUserConversationsForSocketIO(user._id);
    conversations.forEach((id) => socket.join(id.toString()));
    socket.join(userId);

    socket.on("disconnect", () => {
      const set = socketsByUser.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          socketsByUser.delete(userId);
          // visibleByUser có thể giữ hoặc xoá đều được, giữ cũng ok
          // visibleByUser.delete(userId);
        }
      }
      emitOnlineUsers();
      console.log(`socket disconnect: ${socket.id}`);
    });

    socket.on("join-conversation", (conversationId) => {
      socket.join(conversationId);
    });

    // ✅ Khi toggle preference: chỉ đổi visibleByUser (KHÔNG đụng socketsByUser)
    socket.on("preferences:showOnlineStatus", (val) => {
      if (typeof val === "boolean") {
        visibleByUser.set(userId, val);
        emitOnlineUsers();
      }
    });
  });

  return io;
};

export const getIo = () => {
  if (!io)
    throw new Error(
      "Socket.io chưa được khởi tạo. Gọi initSocket(server) trước.",
    );
  return io;
};
