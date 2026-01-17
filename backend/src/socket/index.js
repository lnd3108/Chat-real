import { Server } from "socket.io";
import { socketAuthMiddleWare } from "../middlewares/socketMiddleWare.js";
import { getUserConversationsForSocketIO } from "../controllers/conversationController.js";

let io;

//Gắn socket.io vào http server
export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
  });

  io.use(socketAuthMiddleWare);

  const onlineUsers = new Map(); //{userId:socketId}

  io.on("connection", async (socket) => {
    const user = socket.user;
    const userId = user._id.toString();
    console.log(`${user.displayName} online với socket ${socket.id}`);

    // onlineUsers.set(user._id.toString(), socket.id);
    // io.emit("online-users", Array.from(onlineUsers.keys()));

    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    io.emit("online-users", Array.from(onlineUsers.keys()));

    const conversations = await getUserConversationsForSocketIO(user._id);
    conversations.forEach((id) => {
      socket.join(id.toString());
    });

    socket.join(user._id.toString()); //Join room cá nhân của user

    socket.on("disconnect", () => {
      const set = onlineUsers.get(userId);

      if (set) {
        set.delete(socket.id);
        if (set.size === 0) onlineUsers.delete(userId);
      }

      // onlineUsers.delete(user._id.toString());
      io.emit("online-users", Array.from(onlineUsers.keys()));
      console.log(`socket disconnect: ${socket.id}`);
    });

    socket.on("join-conversation", (conversationId) => {
      socket.join(conversationId);
    });
  });

  return io;
};

//Lấy instance io để dùng ở controller/service
export const getIo = () => {
  if (!io)
    throw new Error(
      "Socket.io chưa được khởi tạo. Gọi initSocket(server) trước."
    );
  return io;
};
