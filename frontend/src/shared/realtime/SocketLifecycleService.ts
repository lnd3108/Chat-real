import type { AdminRoleSocketHandler } from "@/features/admin/realtime/AdminRoleSocketHandler";
import type { AccountSocketHandler } from "@/features/auth/realtime/AccountSocketHandler";
import type { ChatSocketHandler } from "@/features/chat/realtime/ChatSocketHandler";
import type { FriendSocketHandler } from "@/features/friend/realtime/FriendSocketHandler";
import type { NotificationSocketHandler } from "@/features/notification/realtime/NotificationSocketHandler";
import type { Socket } from "socket.io-client";

interface SocketDomainHandler {
  register(socket: Socket): void;
  unregister(socket: Socket): void;
}

export class SocketLifecycleService {
  private readonly handlers: SocketDomainHandler[];

  constructor(
    chatHandler: ChatSocketHandler,
    friendHandler: FriendSocketHandler,
    accountHandler: AccountSocketHandler,
    adminRoleHandler: AdminRoleSocketHandler,
    notificationHandler: NotificationSocketHandler,
  ) {
    this.handlers = [
      chatHandler,
      friendHandler,
      accountHandler,
      adminRoleHandler,
      notificationHandler,
    ];
  }

  register(socket: Socket) {
    this.unregister(socket);
    this.handlers.forEach((handler) => handler.register(socket));
  }

  unregister(socket: Socket) {
    this.handlers.forEach((handler) => handler.unregister(socket));
  }
}
