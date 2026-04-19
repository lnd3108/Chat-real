import { useEffect, useState } from "react";
import { axiosInstance } from "@/lib/axios";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Users, MessageSquare, HardDrive, BarChart3 } from "lucide-react";

interface DashboardStats {
  totalUsers: number;
  totalAdmins: number;
  totalConversations: number;
  totalMessages: number;
  totalFriendRequests: number;
  totalBlocks: number;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get("/admin/dashboard");
        setStats(response.data.data);
      } catch (err: any) {
        console.error("Lỗi khi lấy thống kê:", err);
        setError(err.response?.data?.message || "Không thể lấy thống kê");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  const statCards = [
    {
      label: "Tổng người dùng",
      value: stats?.totalUsers || 0,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Quản trị viên",
      value: stats?.totalAdmins || 0,
      icon: HardDrive,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Cuộc trò chuyện",
      value: stats?.totalConversations || 0,
      icon: MessageSquare,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Tin nhắn",
      value: stats?.totalMessages || 0,
      icon: BarChart3,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      label: "Lời mời kết bạn",
      value: stats?.totalFriendRequests || 0,
      icon: Users,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
    {
      label: "Khối chặn",
      value: stats?.totalBlocks || 0,
      icon: HardDrive,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Xin chào quản trị viên! Đây là trang tổng quan hệ thống.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm hover:border-border transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {card.value.toLocaleString("vi-VN")}
                  </p>
                </div>
                <div className={`rounded-lg p-3 ${card.bgColor}`}>
                  <Icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Content Section */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-foreground">Chức năng nâng cấp</h2>
        <p className="mt-2 text-muted-foreground">
          Khu vực admin đang trong giai đoạn phát triển. Các tính năng tiếp theo sẽ được thêm vào:
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>✓ Quản lý người dùng - Xem, chỉnh sửa, xóa tài khoản</li>
          <li>✓ Quản lý cuộc trò chuyện - Xem, kiểm duyệt</li>
          <li>✓ Quản lý tin nhắn - Xem, xóa</li>
          <li>✓ Báo cáo vi phạm - Xử lý khiếu nại</li>
          <li>✓ Cài đặt hệ thống - Quản lý cấu hình</li>
          <li>✓ Nhật ký hoạt động - Theo dõi log hệ thống</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminDashboard;
