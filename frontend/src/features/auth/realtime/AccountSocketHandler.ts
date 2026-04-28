import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";

interface AccountSocketHandlerOptions {
  clearSocketState: () => void;
}

export class AccountSocketHandler {
  private socket: Socket | null = null;
  private readonly options: AccountSocketHandlerOptions;

  constructor(options: AccountSocketHandlerOptions) {
    this.options = options;
  }

  register(socket: Socket) {
    this.unregister(socket);
    this.socket = socket;
    socket.on("account:deleted", this.handleAccountDeleted);
    socket.on("account:banned", this.handleAccountBanned);
  }

  unregister(socket: Socket) {
    socket.off("account:deleted", this.handleAccountDeleted);
    socket.off("account:banned", this.handleAccountBanned);
    if (this.socket === socket) this.socket = null;
  }

  forceLogoutForBannedAccount = (message?: string) => {
    const { clearState } = useAuthStore.getState();
    const { reset } = useChatStore.getState();

    clearState();
    reset();
    if (this.socket) {
      this.socket.io.opts.reconnection = false;
      this.socket.disconnect();
    }
    this.options.clearSocketState();

    if (typeof window !== "undefined") {
      toast.error(message || "Tài khoản của bạn đã bị khóa.");
      window.location.href = "/signin";
    }
  };

  private handleAccountDeleted = () => {
    const { clearState } = useAuthStore.getState();
    const { reset } = useChatStore.getState();

    clearState();
    reset();
    if (this.socket) {
      this.socket.io.opts.reconnection = false;
      this.socket.disconnect();
    }
    this.options.clearSocketState();
  };

  private handleAccountBanned = ({ message } = { message: undefined }) => {
    this.forceLogoutForBannedAccount(message);
  };
}
