import { useEffect, useState } from "react";
import { Link } from "react-router";
import axios from "axios";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Flag,
  Heart,
  LifeBuoy,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { axiosInstance } from "@/lib/axios";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";

interface DashboardOverview {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  deletedUsers: number;
  newUsersLast7Days: number;
  totalDirectConversations: number;
  totalGroupConversations: number;
  totalSupportConversations: number;
  totalMessages: number;
  newGroupsLast7Days: number;
  totalAcceptedFriends: number;
  totalPendingFriendRequests: number;
  totalActiveBlocks: number;
  totalPendingReports: number;
  totalReviewingReports: number;
  totalOpenSupportConversations: number;
  totalInProgressSupportConversations: number;
}

interface StatCardItem {
  title: string;
  value: number;
  description: string;
  to?: string;
  accent: string;
}

const formatNumber = (value: number) => value.toLocaleString("vi-VN");

const DashboardHeroSkeleton = () => (
  <div className="rounded-[28px] border border-border/50 bg-card/70 p-6 shadow-sm">
    <Skeleton className="h-4 w-28" />
    <Skeleton className="mt-3 h-10 w-64" />
    <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
    <Skeleton className="mt-2 h-4 w-full max-w-xl" />
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="rounded-2xl border border-border/50 p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-20" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  </div>
);

const DashboardSectionSkeleton = () => (
  <div className="rounded-[28px] border border-border/50 bg-card/65 p-6 shadow-sm">
    <Skeleton className="h-5 w-40" />
    <Skeleton className="mt-3 h-4 w-full max-w-xl" />
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="rounded-2xl border border-border/50 p-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-9 w-24" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </div>
      ))}
    </div>
  </div>
);

const StatCard = ({ title, value, description, to, accent }: StatCardItem) => {
  const content = (
    <div
      className={cn(
        "group rounded-2xl border border-border/50 bg-background/70 p-5 shadow-sm transition-all",
        to && "hover:-translate-y-0.5 hover:border-border hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">
            {formatNumber(value)}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className={cn("h-3 w-3 shrink-0 rounded-full", accent)} />
      </div>

      {to ? (
        <div className="mt-5 flex items-center text-sm font-medium text-primary">
          <span>Mở module</span>
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      ) : null}
    </div>
  );

  if (!to) return content;

  return (
    <Link to={to} className="block">
      {content}
    </Link>
  );
};

const DashboardSection = ({
  title,
  description,
  icon: Icon,
  items,
}: {
  title: string;
  description: string;
  icon: typeof Users;
  items: StatCardItem[];
}) => (
  <section className="rounded-[28px] border border-border/50 bg-card/65 p-6 shadow-sm">
    <div className="flex items-center gap-3">
      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>

    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <StatCard key={item.title} {...item} />
      ))}
    </div>
  </section>
);

const AdminDashboard = () => {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axiosInstance.get("/admin/dashboard/overview");
      setOverview(response.data.data);
    } catch (err: unknown) {
      console.error("Không thể tải overview admin:", err);
      setOverview(null);
      setError(
        axios.isAxiosError(err) && typeof err.response?.data?.message === "string"
          ? err.response.data.message
          : "Không thể tải dữ liệu tổng quan dashboard.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOverview();
  }, []);

  const userCards: StatCardItem[] = [
    {
      title: "Tổng người dùng",
      value: overview?.totalUsers ?? 0,
      description: "Số tài khoản hiện có trong toàn hệ thống.",
      to: "/admin/users",
      accent: "bg-blue-500",
    },
    {
      title: "Đang hoạt động",
      value: overview?.activeUsers ?? 0,
      description: "Người dùng đang ở trạng thái hoạt động.",
      to: "/admin/users",
      accent: "bg-emerald-500",
    },
    {
      title: "Bị khóa",
      value: overview?.bannedUsers ?? 0,
      description: "Tài khoản đã bị admin khóa truy cập.",
      to: "/admin/users",
      accent: "bg-rose-500",
    },
    {
      title: "Đã xóa",
      value: overview?.deletedUsers ?? 0,
      description: "Giữ sẵn cho soft delete hoặc lưu trữ sau này.",
      to: "/admin/users",
      accent: "bg-slate-500",
    },
    {
      title: "Người dùng mới 7 ngày",
      value: overview?.newUsersLast7Days ?? 0,
      description: "Tài khoản được tạo trong 7 ngày gần nhất.",
      to: "/admin/users",
      accent: "bg-cyan-500",
    },
  ];

  const chatCards: StatCardItem[] = [
    {
      title: "Cuộc trò chuyện trực tiếp",
      value: overview?.totalDirectConversations ?? 0,
      description: "Tổng số cuộc trò chuyện 1-1.",
      to: "/admin/conversations",
      accent: "bg-indigo-500",
    },
    {
      title: "Nhóm chat",
      value: overview?.totalGroupConversations ?? 0,
      description: "Tổng số nhóm chat hiện có.",
      to: "/admin/conversations",
      accent: "bg-violet-500",
    },
    {
      title: "Hội thoại hỗ trợ",
      value: overview?.totalSupportConversations ?? 0,
      description: "Số cuộc hội thoại thuộc luồng hỗ trợ.",
      to: "/admin/support",
      accent: "bg-sky-500",
    },
    {
      title: "Tổng tin nhắn",
      value: overview?.totalMessages ?? 0,
      description: "Khối lượng tin nhắn toàn hệ thống.",
      to: "/admin/conversations",
      accent: "bg-amber-500",
    },
    {
      title: "Nhóm mới 7 ngày",
      value: overview?.newGroupsLast7Days ?? 0,
      description: "Nhóm chat được tạo mới trong tuần gần nhất.",
      to: "/admin/conversations",
      accent: "bg-fuchsia-500",
    },
  ];

  const relationshipCards: StatCardItem[] = [
    {
      title: "Bạn bè đã chấp nhận",
      value: overview?.totalAcceptedFriends ?? 0,
      description: "Tổng quan hệ bạn bè đang tồn tại.",
      to: "/admin/friends",
      accent: "bg-pink-500",
    },
    {
      title: "Lời mời đang chờ",
      value: overview?.totalPendingFriendRequests ?? 0,
      description: "Lời mời kết bạn đang chờ xử lý.",
      to: "/admin/friend-requests",
      accent: "bg-yellow-500",
    },
    {
      title: "Khối chặn đang hiệu lực",
      value: overview?.totalActiveBlocks ?? 0,
      description: "Quan hệ block direct còn hiệu lực.",
      to: "/admin/blocks",
      accent: "bg-red-500",
    },
  ];

  const moderationCards: StatCardItem[] = [
    {
      title: "Báo cáo chờ xử lý",
      value: overview?.totalPendingReports ?? 0,
      description: "Báo cáo mới chưa được admin nhận xử lý.",
      to: "/admin/reports",
      accent: "bg-orange-500",
    },
    {
      title: "Báo cáo đang xem xét",
      value: overview?.totalReviewingReports ?? 0,
      description: "Báo cáo đang trong quá trình kiểm duyệt.",
      to: "/admin/reports",
      accent: "bg-blue-500",
    },
    {
      title: "Hỗ trợ đang mở",
      value: overview?.totalOpenSupportConversations ?? 0,
      description: "Yêu cầu hỗ trợ mới chưa có người nhận.",
      to: "/admin/support",
      accent: "bg-teal-500",
    },
    {
      title: "Hỗ trợ đang xử lý",
      value: overview?.totalInProgressSupportConversations ?? 0,
      description: "Yêu cầu hỗ trợ đang được admin xử lý.",
      to: "/admin/support",
      accent: "bg-lime-500",
    },
  ];

  const quickActions = [
    {
      title: "Quản lý user",
      description: "Xem tài khoản, trạng thái và phân quyền admin.",
      to: "/admin/users",
      icon: Users,
    },
    {
      title: "Xem báo cáo",
      description: "Đi tới khu moderation để xử lý báo cáo.",
      to: "/admin/reports",
      icon: Flag,
    },
    {
      title: "Xem hỗ trợ",
      description: "Theo dõi hội thoại hỗ trợ đang mở hoặc đang xử lý.",
      to: "/admin/support",
      icon: LifeBuoy,
    },
  ];

  const healthHighlights = [
    {
      label: "Người dùng mới 7 ngày",
      value: overview?.newUsersLast7Days ?? 0,
      icon: UserPlus,
    },
    {
      label: "Báo cáo cần chú ý",
      value:
        (overview?.totalPendingReports ?? 0) +
        (overview?.totalReviewingReports ?? 0),
      icon: AlertTriangle,
    },
    {
      label: "Hỗ trợ đang mở",
      value: overview?.totalOpenSupportConversations ?? 0,
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-6">
      {loading ? (
        <>
          <DashboardHeroSkeleton />
          <DashboardSectionSkeleton />
          <DashboardSectionSkeleton />
          <DashboardSectionSkeleton />
          <DashboardSectionSkeleton />
        </>
      ) : error ? (
        <section className="rounded-[28px] border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-destructive">
                Dashboard không khả dụng
              </p>
              <h1 className="mt-2 text-3xl font-bold text-foreground">
                Không thể tải tổng quan admin
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {error}. Dashboard vẫn được thiết kế fail-safe nên các module
                admin riêng như Người dùng, Báo cáo hoặc Hỗ trợ vẫn có thể truy
                cập độc lập.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-destructive/30 bg-background/70"
              onClick={() => void fetchOverview()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Tải lại
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section className="overflow-hidden rounded-[28px] border border-border/50 bg-[linear-gradient(135deg,rgba(14,165,233,0.10),rgba(59,130,246,0.06),rgba(255,255,255,0))] p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary/80">
              Tổng quan hệ thống
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Chào {user?.displayName ?? "Admin"}, đây là tổng quan vận hành hệ
              thống.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
              Trang này tập trung vào các số liệu tổng hợp nhẹ, dễ đọc và dễ mở
              rộng. Dùng overview để nắm nhanh tình hình rồi đi tiếp vào Người
              dùng, Khối chặn, Bạn bè, Lời mời kết bạn, Cuộc trò chuyện, Báo cáo
              và Hỗ trợ.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {healthHighlights.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border/50 bg-background/75 p-4 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-primary/10 p-2 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {item.label}
                      </p>
                    </div>
                    <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">
                      {formatNumber(item.value)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[28px] border border-border/50 bg-card/65 p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Thao tác nhanh
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Lối tắt vào các khu vực admin chính cần truy cập thường xuyên.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                onClick={() => void fetchOverview()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Làm mới số liệu
              </Button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Link
                    key={action.title}
                    to={action.to}
                    className="group rounded-2xl border border-border/50 bg-background/70 p-5 transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-foreground">
                      {action.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {action.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>

          <DashboardSection
            title="Người dùng"
            description="Theo dõi quy mô người dùng, trạng thái tài khoản và tăng trưởng gần đây."
            icon={Users}
            items={userCards}
          />

          <DashboardSection
            title="Chat"
            description="Tổng hợp chat trực tiếp, nhóm chat, hỗ trợ và khối lượng tin nhắn."
            icon={MessageSquare}
            items={chatCards}
          />

          <DashboardSection
            title="Quan hệ"
            description="Theo dõi bạn bè, lời mời kết bạn và các quan hệ block đang hoạt động."
            icon={Heart}
            items={relationshipCards}
          />

          <DashboardSection
            title="Kiểm duyệt / Hỗ trợ"
            description="Ưu tiên các tín hiệu cần admin xử lý sớm như báo cáo và hội thoại hỗ trợ."
            icon={Ban}
            items={moderationCards}
          />
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
