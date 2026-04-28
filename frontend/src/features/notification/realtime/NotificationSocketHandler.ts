import type { Socket } from "socket.io-client";

export class NotificationSocketHandler {
  register(_socket: Socket) {
    // Notification-producing events are currently owned by their domain handlers.
  }

  unregister(_socket: Socket) {
    // Kept for lifecycle symmetry and future notification-only events.
  }
}
