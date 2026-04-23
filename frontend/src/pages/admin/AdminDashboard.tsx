import { useEffect, useMemo, useState } from "react";
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
import { getErrorMeta, logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAdminDashboardStore } from "@/stores/useAdminDashboardStore";

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

interface UserChartPoint {
  date: string;
  label: string;
  total: number;
}

interface MessageChartPoint {
  date: string;
  label: string;
  direct: number;
  group: number;
  support: number;
  total: number;
}

interface StatusChartItem {
  status: string;
  label: string;
  total: number;
}

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

const formatNumber = (value: number) => value.toLocaleString("vi-VN");

const getAxiosMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) && typeof error.response?.data?.message === "string"
    ? error.response.data.message
    : fallback;

const chartLegend = {
  direct: {
    label: "Direct",
    className: "bg-sky-500",
  },
  group: {
    label: "Group",
    className: "bg-violet-500",
  },
  support: {
    label: "Support",
    className: "bg-emerald-500",
  },
};

const reportColors: Record<string, string> = {
  pending: "bg-amber-500",
  reviewing: "bg-blue-500",
  resolved: "bg-emerald-500",
  rejected: "bg-rose-500",
};

const supportColors: Record<string, string> = {
  open: "bg-sky-500",
  in_progress: "bg-amber-500",
  resolved: "bg-emerald-500",
  closed: "bg-slate-500",
};

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

const ChartShell = ({
  title,
  description,
  loading,
  error,
  actions,
  children,
}: {
  title: string;
  description: string;
  loading: boolean;
  error: string | null;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="rounded-[28px] border border-border/50 bg-card/65 p-6 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {actions}
    </div>

    <div className="mt-6">
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        children
      )}
    </div>
  </section>
);

const EmptyChartState = ({ message }: { message: string }) => (
  <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background/40 p-6 text-center text-sm text-muted-foreground">
    {message}
  </div>
);

const LineChart = ({ points }: { points: UserChartPoint[] }) => {
  const maxValue = Math.max(...points.map((point) => point.total), 0);

  if (!points.length || maxValue === 0) {
    return (
      <EmptyChartState message="Chưa có dữ liệu người dùng mới trong khoảng thời gian này." />
    );
  }

  const width = 100;
  const height = 100;
  const bottomPadding = 14;
  const topPadding = 10;
  const xStep = points.length > 1 ? width / (points.length - 1) : width;
  const usableHeight = height - bottomPadding - topPadding;

  const chartPoints = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : index * xStep;
    const y = topPadding + usableHeight - (point.total / maxValue) * usableHeight;
    return { ...point, x, y };
  });

  const path = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${path} L ${chartPoints[chartPoints.length - 1]?.x ?? 0} ${height - bottomPadding} L ${chartPoints[0]?.x ?? 0} ${height - bottomPadding} Z`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Tổng user mới</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {formatNumber(points.reduce((sum, point) => sum + point.total, 0))}
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>Đỉnh cao nhất</p>
          <p className="mt-1 font-medium text-foreground">
            {formatNumber(maxValue)} user
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full overflow-visible">
          {[0, 1, 2, 3].map((step) => {
            const y = topPadding + (usableHeight / 3) * step;
            return (
              <line
                key={step}
                x1="0"
                y1={y}
                x2={width}
                y2={y}
                stroke="currentColor"
                className="text-border/60"
                strokeDasharray="1.5 2.5"
                strokeWidth="0.4"
              />
            );
          })}

          <path d={areaPath} fill="url(#userArea)" opacity="0.2" />
          <path
            d={path}
            fill="none"
            stroke="currentColor"
            className="text-primary"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {chartPoints.map((point) => (
            <g key={point.date}>
              <circle
                cx={point.x}
                cy={point.y}
                r="1.8"
                fill="currentColor"
                className="text-primary"
              />
              <text
                x={point.x}
                y={height - 3}
                textAnchor="middle"
                className="fill-muted-foreground text-[4px]"
              >
                {point.label}
              </text>
            </g>
          ))}

          <defs>
            <linearGradient id="userArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" className="text-primary" />
              <stop
                offset="100%"
                stopColor="currentColor"
                stopOpacity="0"
                className="text-primary"
              />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};

const StackedMessageChart = ({ points }: { points: MessageChartPoint[] }) => {
  const maxValue = Math.max(...points.map((point) => point.total), 0);

  if (!points.length || maxValue === 0) {
    return (
      <EmptyChartState message="Chưa có dữ liệu tin nhắn trong khoảng thời gian này." />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {Object.entries(chartLegend).map(([key, item]) => (
          <div key={key} className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={cn("h-3 w-3 rounded-full", item.className)} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
        <div className="flex h-64 items-end gap-3 overflow-x-auto">
          {points.map((point) => {
            const heightPercent = (point.total / maxValue) * 100;
            const directPercent = point.total ? (point.direct / point.total) * 100 : 0;
            const groupPercent = point.total ? (point.group / point.total) * 100 : 0;
            const supportPercent = point.total ? (point.support / point.total) * 100 : 0;

            return (
              <div key={point.date} className="flex min-w-12 flex-1 flex-col items-center gap-2">
                <div className="text-xs font-medium text-foreground">
                  {formatNumber(point.total)}
                </div>
                <div className="flex h-52 w-full items-end justify-center">
                  <div
                    className="flex w-full max-w-10 flex-col overflow-hidden rounded-t-xl bg-muted/40"
                    style={{ height: `${Math.max(heightPercent, 6)}%` }}
                    title={`${point.label}: ${point.total} tin nhắn`}
                  >
                    <div className="bg-emerald-500" style={{ height: `${supportPercent}%` }} />
                    <div className="bg-violet-500" style={{ height: `${groupPercent}%` }} />
                    <div className="bg-sky-500" style={{ height: `${directPercent}%` }} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{point.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const StatusBars = ({
  items,
  colorMap,
  emptyMessage,
}: {
  items: StatusChartItem[];
  colorMap: Record<string, string>;
  emptyMessage: string;
}) => {
  const maxValue = Math.max(...items.map((item) => item.total), 0);
  const total = items.reduce((sum, item) => sum + item.total, 0);

  if (!items.length || total === 0) {
    return <EmptyChartState message={emptyMessage} />;
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Tổng trạng thái:{" "}
        <span className="font-semibold text-foreground">{formatNumber(total)}</span>
      </div>

      <div className="space-y-4 rounded-2xl border border-border/50 bg-background/60 p-4">
        {items.map((item) => {
          const widthPercent = maxValue ? (item.total / maxValue) * 100 : 0;

          return (
            <div key={item.status} className="space-y-2">
              <div className="flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className={cn("h-3 w-3 rounded-full", colorMap[item.status])} />
                  <span className="font-medium text-foreground">{item.label}</span>
                </div>
                <span className="text-muted-foreground">{formatNumber(item.total)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted/60">
                <div
                  className={cn("h-full rounded-full", colorMap[item.status])}
                  style={{ width: `${Math.max(widthPercent, item.total > 0 ? 8 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const user = useAuthStore((state) => state.user);
  const dashboardOverview = useAdminDashboardStore((state) => state.overview);
  const dashboardLoading = useAdminDashboardStore((state) => state.loading);
  const dashboardError = useAdminDashboardStore((state) => state.error);
  const fetchDashboardOverview = useAdminDashboardStore((state) => state.fetchOverview);
  const [userRange, setUserRange] = useState<7 | 30>(7);
  const [messageRange, setMessageRange] = useState<7 | 30>(7);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [userChart, setUserChart] = useState<ApiState<UserChartPoint[]>>({
    data: null,
    loading: true,
    error: null,
  });
  const [messageChart, setMessageChart] = useState<ApiState<MessageChartPoint[]>>({
    data: null,
    loading: true,
    error: null,
  });
  const [reportChart, setReportChart] = useState<ApiState<StatusChartItem[]>>({
    data: null,
    loading: true,
    error: null,
  });
  const [supportChart, setSupportChart] = useState<ApiState<StatusChartItem[]>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchOverview = async () => {
    try {
      setOverviewLoading(true);
      setOverviewError(null);

      const response = await axiosInstance.get("/admin/dashboard/overview");
      setOverview(response.data.data);
    } catch (err: unknown) {
      logger.error("Không thể tải overview admin", getErrorMeta(err));
      setOverview(null);
      setOverviewError(getAxiosMessage(err, "Không thể tải dữ liệu tổng quan dashboard."));
    } finally {
      setOverviewLoading(false);
    }
  };

  const fetchUserChart = async (days: 7 | 30) => {
    try {
      setUserChart((current) => ({ ...current, loading: true, error: null }));
      const response = await axiosInstance.get("/admin/dashboard/charts/users", {
        params: { days },
      });
      setUserChart({
        data: response.data.data.points ?? [],
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      setUserChart({
        data: null,
        loading: false,
        error: getAxiosMessage(err, "Không thể tải biểu đồ người dùng mới."),
      });
    }
  };

  const fetchMessageChart = async (days: 7 | 30) => {
    try {
      setMessageChart((current) => ({ ...current, loading: true, error: null }));
      const response = await axiosInstance.get("/admin/dashboard/charts/messages", {
        params: { days },
      });
      setMessageChart({
        data: response.data.data.points ?? [],
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      setMessageChart({
        data: null,
        loading: false,
        error: getAxiosMessage(err, "Không thể tải biểu đồ tin nhắn."),
      });
    }
  };

  const fetchReportChart = async () => {
    try {
      setReportChart((current) => ({ ...current, loading: true, error: null }));
      const response = await axiosInstance.get("/admin/dashboard/charts/reports");
      setReportChart({
        data: response.data.data.items ?? [],
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      setReportChart({
        data: null,
        loading: false,
        error: getAxiosMessage(err, "Không thể tải biểu đồ báo cáo."),
      });
    }
  };

  const fetchSupportChart = async () => {
    try {
      setSupportChart((current) => ({ ...current, loading: true, error: null }));
      const response = await axiosInstance.get("/admin/dashboard/charts/support");
      setSupportChart({
        data: response.data.data.items ?? [],
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      setSupportChart({
        data: null,
        loading: false,
        error: getAxiosMessage(err, "Không thể tải biểu đồ hỗ trợ."),
      });
    }
  };

  useEffect(() => {
    void fetchOverview();
    void fetchReportChart();
    void fetchSupportChart();
  }, []);

  useEffect(() => {
    void fetchDashboardOverview();
  }, [fetchDashboardOverview]);

  useEffect(() => {
    if (dashboardOverview) {
      setOverview(dashboardOverview as DashboardOverview);
    }
  }, [dashboardOverview]);

  useEffect(() => {
    setOverviewLoading(dashboardLoading);
  }, [dashboardLoading]);

  useEffect(() => {
    setOverviewError(dashboardError);
  }, [dashboardError]);

  useEffect(() => {
    void fetchUserChart(userRange);
  }, [userRange]);

  useEffect(() => {
    void fetchMessageChart(messageRange);
  }, [messageRange]);

  const refreshAll = async () => {
    await Promise.all([
      fetchOverview(),
      fetchUserChart(userRange),
      fetchMessageChart(messageRange),
      fetchReportChart(),
      fetchSupportChart(),
    ]);
  };

  const userCards: StatCardItem[] = useMemo(
    () => [
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
    ],
    [overview],
  );

  const chatCards: StatCardItem[] = useMemo(
    () => [
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
    ],
    [overview],
  );

  const relationshipCards: StatCardItem[] = useMemo(
    () => [
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
    ],
    [overview],
  );

  const moderationCards: StatCardItem[] = useMemo(
    () => [
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
    ],
    [overview],
  );

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

  const overviewIsLoading = overviewLoading && !overview;

  return (
    <div className="space-y-6">
      {overviewIsLoading ? (
        <>
          <DashboardHeroSkeleton />
          <DashboardSectionSkeleton />
          <DashboardSectionSkeleton />
          <DashboardSectionSkeleton />
          <DashboardSectionSkeleton />
        </>
      ) : overviewError ? (
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
                {overviewError}. Dashboard vẫn được thiết kế fail-safe nên các
                module admin riêng như Người dùng, Báo cáo hoặc Hỗ trợ vẫn có thể
                truy cập độc lập.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-destructive/30 bg-background/70"
              onClick={() => void refreshAll()}
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
              Chào {user?.displayName ?? "Admin"}, đây là tổng quan vận hành hệ thống.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
              Bản đầu ưu tiên card và biểu đồ cơ bản, nhẹ và dễ debug. Mỗi chart
              dùng API riêng để khi một module lỗi vẫn không làm vỡ toàn bộ dashboard.
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
                <h2 className="text-xl font-semibold text-foreground">Thao tác nhanh</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Lối tắt vào các khu vực admin chính cần truy cập thường xuyên.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                onClick={() => void refreshAll()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Làm mới toàn bộ
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

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartShell
              title="User mới theo ngày"
              description={`Line chart cho ${userRange} ngày gần nhất.`}
              loading={userChart.loading}
              error={userChart.error}
              actions={
                <div className="flex items-center gap-2">
                  {[7, 30].map((days) => (
                    <Button
                      key={days}
                      type="button"
                      variant={userRange === days ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUserRange(days as 7 | 30)}
                    >
                      {days} ngày
                    </Button>
                  ))}
                </div>
              }
            >
              <LineChart points={userChart.data ?? []} />
            </ChartShell>

            <ChartShell
              title="Messages theo ngày"
              description={`Stacked bar chart tách direct / group / support trong ${messageRange} ngày gần nhất.`}
              loading={messageChart.loading}
              error={messageChart.error}
              actions={
                <div className="flex items-center gap-2">
                  {[7, 30].map((days) => (
                    <Button
                      key={days}
                      type="button"
                      variant={messageRange === days ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMessageRange(days as 7 | 30)}
                    >
                      {days} ngày
                    </Button>
                  ))}
                </div>
              }
            >
              <StackedMessageChart points={messageChart.data ?? []} />
            </ChartShell>
          </div>

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

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartShell
              title="Reports theo trạng thái"
              description="Số lượng report đang ở các trạng thái moderation chính."
              loading={reportChart.loading}
              error={reportChart.error}
            >
              <StatusBars
                items={reportChart.data ?? []}
                colorMap={reportColors}
                emptyMessage="Chưa có report nào trong hệ thống."
              />
            </ChartShell>

            <ChartShell
              title="Support conversations theo trạng thái"
              description="Theo dõi khối lượng support theo tiến độ xử lý."
              loading={supportChart.loading}
              error={supportChart.error}
            >
              <StatusBars
                items={supportChart.data ?? []}
                colorMap={supportColors}
                emptyMessage="Chưa có hội thoại hỗ trợ nào trong hệ thống."
              />
            </ChartShell>
          </div>

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
