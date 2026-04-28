import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { axiosInstance } from "@/shared/api/axios";

const MaintenanceModeModal = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Add interceptor to catch 503 maintenance responses
    const interceptor = axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (
          error.response?.status === 503 &&
          error.response?.data?.code === "MAINTENANCE_MODE"
        ) {
          setMessage(
            error.response?.data?.message ||
            "Hệ thống đang bảo trì. Vui lòng thử lại sau."
          );
          setIsVisible(true);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axiosInstance.interceptors.response.eject(interceptor);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-lg border border-amber-500/50 bg-card p-6 shadow-lg">
        {/* Close button */}
        <button
          onClick={() => setIsVisible(false)}
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="pr-8">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                🔧 Hệ Thống Đang Bảo Trì
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {message}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex gap-2">
            <Button
              onClick={() => window.location.reload()}
              variant="default"
            >
              Tải Lại
            </Button>
            <Button
              onClick={() => setIsVisible(false)}
              variant="outline"
            >
              Đóng
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceModeModal;
