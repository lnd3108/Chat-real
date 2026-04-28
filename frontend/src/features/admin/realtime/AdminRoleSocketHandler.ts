import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { hasAdminPanelAccess } from "@/shared/lib/rbac";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";

export class AdminRoleSocketHandler {
  register(socket: Socket) {
    this.unregister(socket);
    socket.on("user:role-updated", this.handleUserRoleUpdated);
  }

  unregister(socket: Socket) {
    socket.off("user:role-updated", this.handleUserRoleUpdated);
  }

  private handleUserRoleUpdated = ({ user, reason }: any) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser || !user?._id || currentUser._id !== user._id) {
      return;
    }

    useAuthStore.getState().setUser({
      ...currentUser,
      ...user,
    });

    if (!hasAdminPanelAccess(user) && window.location.pathname.startsWith("/admin")) {
      toast.warning(reason || "Quyền admin của bạn đã bị thu hồi.");
    } else {
      toast.success(reason || "Quyền tài khoản của bạn đã được cập nhật.");
    }
  };
}
