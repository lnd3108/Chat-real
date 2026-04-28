import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { useNavigate } from "react-router";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { LoadingSpinner } from "@/shared/ui/loading-spinner";
import { authService } from "@/features/auth/services/authService";
import { abortAllRequests } from "@/shared/api/axios";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useSocketStore } from "@/shared/realtime/useSocketStore";

type Props = {
  open: boolean;
  setOpen: (val: boolean) => void;
};

type DeleteSessionState = {
  confirmText: string;
  code: string;
  email: string | null;
  expiresAt: number | null;
  resendAvailableAt: number | null;
};

const DELETE_CONFIRM_WORD = "DELETE";
const AUTH_REDIRECT_TOAST_KEY = "auth_redirect_toast";
const DELETE_ACCOUNT_SESSION_KEY = "delete_account_verification_session";

const emptyDeleteSession: DeleteSessionState = {
  confirmText: "",
  code: "",
  email: null,
  expiresAt: null,
  resendAvailableAt: null,
};

const readDeleteSession = (): DeleteSessionState => {
  const rawValue = window.sessionStorage.getItem(DELETE_ACCOUNT_SESSION_KEY);
  if (!rawValue) return emptyDeleteSession;

  try {
    const parsed = JSON.parse(rawValue) as DeleteSessionState;
    return {
      confirmText: parsed.confirmText || "",
      code: parsed.code || "",
      email: parsed.email || null,
      expiresAt: parsed.expiresAt || null,
      resendAvailableAt: parsed.resendAvailableAt || null,
    };
  } catch {
    return emptyDeleteSession;
  }
};

const DeleteAccountDialog = ({ open, setOpen }: Props) => {
  const navigate = useNavigate();
  const clearState = useAuthStore((s) => s.clearState);
  const disconnectSocket = useSocketStore((s) => s.disconnectSocket);

  const initialSession = useMemo(() => readDeleteSession(), []);

  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState(initialSession.confirmText);
  const [code, setCode] = useState(initialSession.code);
  const [email, setEmail] = useState<string | null>(initialSession.email);
  const [expiresAt, setExpiresAt] = useState<number | null>(
    initialSession.expiresAt,
  );
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(
    initialSession.resendAvailableAt,
  );
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const nextState: DeleteSessionState = {
      confirmText,
      code,
      email,
      expiresAt,
      resendAvailableAt,
    };

    const hasSession =
      Boolean(nextState.confirmText) ||
      Boolean(nextState.code) ||
      Boolean(nextState.email) ||
      Boolean(nextState.expiresAt) ||
      Boolean(nextState.resendAvailableAt);

    if (!hasSession) {
      window.sessionStorage.removeItem(DELETE_ACCOUNT_SESSION_KEY);
      return;
    }

    window.sessionStorage.setItem(
      DELETE_ACCOUNT_SESSION_KEY,
      JSON.stringify(nextState),
    );
  }, [code, confirmText, email, expiresAt, resendAvailableAt]);

  const resetDialog = () => {
    setConfirmText("");
    setCode("");
    setEmail(null);
    setExpiresAt(null);
    setResendAvailableAt(null);
    setLoading(false);
    window.sessionStorage.removeItem(DELETE_ACCOUNT_SESSION_KEY);
  };

  const handleCancel = () => {
    resetDialog();
    setOpen(false);
  };

  const handleDismiss = (nextOpen: boolean) => {
    setOpen(nextOpen);
  };

  const isDeleteWordValid = useMemo(
    () => confirmText.trim().toUpperCase() === DELETE_CONFIRM_WORD,
    [confirmText],
  );
  const isCodeValid = /^\d{6}$/.test(code.trim());
  const hasRequestedCode = Boolean(email && expiresAt);
  const secondsToExpire = useMemo(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.ceil((expiresAt - now) / 1000));
  }, [expiresAt, now]);
  const secondsToResend = useMemo(() => {
    if (!resendAvailableAt) return 0;
    return Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));
  }, [now, resendAvailableAt]);
  const canResend = secondsToResend <= 0 && !loading;
  const isExpired = hasRequestedCode && secondsToExpire <= 0;

  useEffect(() => {
    if (!isExpired) return;

    resetDialog();
    toast.error(
      "Yêu cầu xóa tài khoản đã hết hạn sau 5 phút. Vui lòng tạo lại yêu cầu mới.",
    );
  }, [isExpired]);

  const getAxiosMessage = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      return error.response.data.message as string;
    }

    return fallback;
  };

  const handleRequestCode = async () => {
    if (!isDeleteWordValid) {
      toast.error(`Vui lòng nhập đúng "${DELETE_CONFIRM_WORD}" để tiếp tục.`);
      return;
    }

    try {
      setLoading(true);
      const result = await authService.requestAccountDeletionCode();
      setEmail(result.email);
      setExpiresAt(result.expiresAt);
      setResendAvailableAt(result.resendAvailableAt);
      toast.success(result.message);
    } catch (error) {
      const message = getAxiosMessage(
        error,
        "Không thể gửi mã xác minh xóa tài khoản.",
      );

      if (axios.isAxiosError(error)) {
        const nextResendAt = error.response?.data?.resendAvailableAt;
        if (typeof nextResendAt === "number") {
          setResendAvailableAt(nextResendAt);
        }
      }

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!isDeleteWordValid) {
      toast.error(`Vui lòng nhập đúng "${DELETE_CONFIRM_WORD}" để xác nhận.`);
      return;
    }

    if (!hasRequestedCode) {
      toast.error("Vui lòng gửi mã xác minh trước khi xóa tài khoản.");
      return;
    }

    if (!isCodeValid) {
      toast.error("Vui lòng nhập mã xác minh gồm 6 chữ số.");
      return;
    }

    try {
      setLoading(true);
      const successMessage =
        "Đã xóa tài khoản thành công. Hẹn gặp lại bạn trong tương lai!";

      await authService.confirmAccountDeletion(confirmText, code);

      // Disconnect socket first to prevent any more socket events
      disconnectSocket();

      // Abort all pending requests
      abortAllRequests();

      // Show immediate success toast before navigation
      toast.success(successMessage);

      window.sessionStorage.setItem(
        AUTH_REDIRECT_TOAST_KEY,
        JSON.stringify({
          type: "success",
          message: "Tài khoản của bạn đã được xóa vĩnh viễn.",
        }),
      );

      resetDialog();
      clearState();
      setOpen(false);

      // Small delay to ensure toast is visible before navigation
      setTimeout(() => {
        navigate("/signin", { replace: true });
      }, 500);
    } catch (error) {
      const message = getAxiosMessage(
        error,
        "Xóa tài khoản thất bại. Vui lòng thử lại.",
      );

      if (
        message.includes("hết hạn") ||
        message.includes("hoạt động") ||
        message.includes("tạo lại yêu cầu")
      ) {
        resetDialog();
      }

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDismiss}>
      <DialogContent className="glass-strong border-border/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Xóa tài khoản
          </DialogTitle>
          <DialogDescription>
            Hành động này không thể hoàn tác. Bạn cần nhập{" "}
            <strong>{DELETE_CONFIRM_WORD}</strong> và xác minh mã được gửi về
            email trong vòng 5 phút trước khi tài khoản bị xóa vĩnh viễn. Nếu
            chỉ đóng cửa sổ, phiên xác minh vẫn được giữ nguyên cho đến khi hết
            hạn hoặc bạn bấm <strong>Hủy</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">Nhập từ xác nhận</Label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="glass-light border-border/30"
              placeholder={`Nhập ${DELETE_CONFIRM_WORD} để tiếp tục`}
            />
          </div>

          <div className="space-y-2 rounded-xl border border-border/30 bg-background/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Bước 1: Gửi mã xác minh</p>
                <p className="text-sm text-muted-foreground">
                  Mã xác minh xóa tài khoản sẽ được gửi tới email đăng nhập của
                  bạn.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={
                  !isDeleteWordValid ||
                  loading ||
                  (hasRequestedCode && !canResend)
                }
                onClick={() => void handleRequestCode()}
              >
                {loading ? (
                  <>
                    <LoadingSpinner className="mr-2 size-4" />
                    Đang gửi...
                  </>
                ) : hasRequestedCode ? (
                  canResend ? (
                    "Gửi lại mã"
                  ) : (
                    `Gửi lại sau ${secondsToResend}s`
                  )
                ) : (
                  "Gửi mã"
                )}
              </Button>
            </div>

            {hasRequestedCode && (
              <p className="text-sm text-muted-foreground">
                Mã đã được gửi tới <strong>{email}</strong>. Phiên xác minh còn
                hiệu lực <strong>{secondsToExpire}s</strong>.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-code">Mã xác minh</Label>
            <Input
              id="delete-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="glass-light border-border/30"
              placeholder="Nhập mã 6 chữ số"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="glass-light flex-1 border-border/30"
              onClick={handleCancel}
              disabled={loading}
            >
              Hủy
            </Button>

            <Button
              variant="destructive"
              className="flex-1"
              disabled={
                !isDeleteWordValid ||
                !isCodeValid ||
                !hasRequestedCode ||
                loading
              }
              onClick={() => void handleConfirmDelete()}
            >
              {loading ? (
                <>
                  <LoadingSpinner className="mr-2 size-4" />
                  Đang xác minh...
                </>
              ) : (
                "Xác minh và xóa"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteAccountDialog;
