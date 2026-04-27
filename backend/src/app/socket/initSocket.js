import { Server } from "socket.io";

import { getUserConversationIdsForRealtime } from "../../modules/chat/application/conversation.query-service.js";
import { socketAuthMiddleWare } from "../../modules/identity/api/socket/socket-auth.middleware.js";
import { SOCKET_ROOMS, USER_SOCKET_EVENTS } from "../../shared/domain/constants/socket-events.js";
import {
  hasAdminPanelAccess,
  serializeUserAccess,
} from "../../shared/domain/rbac/access-policy.js";
import {
  disconnectAllNonAdminSockets,
  disconnectUserSockets as disconnectUserSocketsFromPresence,
  emitAdminUserPresence,
  emitOnlineUsers,
  getOnlineUsersCount,
  registerSocketConnection,
  setConversationActiveForSocket,
  setUserVisibility,
  unregisterSocketConnection,
  isConversationActiveForUser,
} from "../../shared/infrastructure/realtime/user-presence.js";
import { emitToUser } from "../../shared/infrastructure/realtime/socket-gateway.js";
import { getIo, setIo } from "../../shared/infrastructure/realtime/socket-registry.js";
import User from "../../models/User.js";
import { emitDashboardStatsUpdated } from "../../services/dashboardRealtimeService.js";

// hàm này xây dựng payload người dùng để gửi qua socket, 
// bao gồm thông tin cơ bản và quyền truy cập của người dùng
const buildSocketUserPayload = (user) => {
  const userAccess = serializeUserAccess(user);

  return {
    _id: user._id,
    displayName: user.displayName,
    userName: user.userName,
    email: user.email ?? null,
    avatarUrl: user.avatarUrl ?? null,
    role: userAccess.role,
    roleLabel: userAccess.roleLabel,
    roleLevel: userAccess.roleLevel,
    permissions: userAccess.permissions,
    status: user.status ?? "active",
    createdAt: user.createdAt ?? null,
  };
};

// hàm này khởi tạo socket.io server và thiết lập các sự kiện liên quan đến kết nối người dùng,
// bao gồm quản lý trạng thái trực tuyến, tham gia phòng trò chuyện, và cập nhật sở thích người dùng
export const initSocket = (server) => {
  const io = setIo(
    new Server(server, {
      cors: { origin: process.env.CLIENT_URL, credentials: true },
    }),
  );

  // xác thực kết nối socket bằng middleware
  io.use(socketAuthMiddleWare);

  // xử lý sự kiện khi có kết nối mới từ client
  io.on("connection", async (socket) => {
    const user = socket.user;
    const userId = user._id.toString();

    //
    let visible = user?.preferences?.showOnlineStatus;
    if (typeof visible !== "boolean") {
      const dbUser = await User.findById(userId).select("preferences.showOnlineStatus");
      visible = dbUser?.preferences?.showOnlineStatus;
    }
    if (typeof visible !== "boolean") {
      visible = true;
    }

    // xây dựng payload người dùng để đăng ký kết nối socket
    const userMeta = buildSocketUserPayload(user);
    // đăng ký kết nối socket và kiểm tra xem người dùng có trở nên trực tuyến hay không
    const { wasOffline } = registerSocketConnection({
      userId,
      socketId: socket.id,
      visible,
      userMeta,
    });

    // tham gia phòng socket riêng của người dùng và phòng dành cho admin nếu có quyền
    socket.join(userId);
    if (hasAdminPanelAccess(user)) {
      socket.join(SOCKET_ROOMS.ADMINS);
    }

    // phát sự kiện cập nhật danh sách người dùng trực tuyến cho tất cả client
    emitOnlineUsers();

    //phát sự kiện thống kê cho admin và cập nhật dashboard nếu người dùng vừa trở nên trực tuyến
    if (wasOffline) {
      emitAdminUserPresence({
        buildSocketUserPayload,
        eventType: USER_SOCKET_EVENTS.ONLINE,
        user,
        isOnline: true,
      });
      void emitDashboardStatsUpdated({ reason: "user:online", userId });
    }

    // tham gia các phòng trò chuyện mà người dùng đang tham gia để nhận thông báo thời gian thực
    const conversations = await getUserConversationIdsForRealtime(user._id);
    conversations.forEach((id) => socket.join(id.toString()));

    // xử lý khi người dùng ngắt kết nối 
    socket.on("disconnect", () => {
      const { becameOffline } = unregisterSocketConnection({
        userId,
        socketId: socket.id,
      });
      emitOnlineUsers();

      if (becameOffline) {
        emitAdminUserPresence({
          buildSocketUserPayload,
          eventType: USER_SOCKET_EVENTS.OFFLINE,
          user,
          isOnline: false,
        });
        void emitDashboardStatsUpdated({ reason: "user:offline", userId });
      }
    });

    //xử lý khi người dùng tham gia một cuộc trò chuyện mới  
    socket.on("join-conversation", (conversationId) => {
      socket.join(conversationId);
    });

    //xử lý khi người dùng rời khỏi một cuộc trò chuyện
    socket.on("leave-conversation", (conversationId) => {
      socket.leave(conversationId);
    });

    //xử lý khi kích hoạt hoặc hủy kích hoạt một cuộc trò chuyện
    socket.on("conversation:active", (conversationId) => {
      setConversationActiveForSocket(
        socket.id,
        typeof conversationId === "string" && conversationId.trim()
          ? conversationId
          : null,
      );
    });

    //xử lý khi người dùng cập nhật sở thích hiển thị trạng thái trực tuyến
    socket.on("preferences:showOnlineStatus", (value) => {
      if (typeof value === "boolean") {
        setUserVisibility(userId, value);
        emitOnlineUsers();
      }
    });
  });

  return io;
};

export {
  emitToUser,
  getIo,
  getOnlineUsersCount,
  isConversationActiveForUser,
};

export const disconnectUserSockets = (userId) =>
  disconnectUserSocketsFromPresence(userId);

export const disconnectAllUserSockets = (message = "Hệ thống đang bảo trì") =>
  disconnectAllNonAdminSockets(message);
