import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Calendar,
  Mail,
  MessageSquare,
  Shield,
  Slash,
  Users,
} from "lucide-react";

import UserAvatar from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { axiosInstance } from "@/lib/axios";

type UserStatus = "active" | "inactive" | "suspended";
type UserRole = "user" | "admin";

interface AdminUserDetailData {
  _id: string;
  avatar: string | null;
  username: string;
  displayName: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  role: UserRole;
}

interface AdminUserStats {
  friendsCount: number;
  directConversationsCount: number;
  groupConversationsCount: number;
  blockingCount: number;
  blockedByCount: number;
  messagesCount: number;
}

const statusConfig: Record<
  UserStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Hoat dong",
    className: "bg-emerald-500/10 text-emerald-700",
  },
  inactive: {
    label: "Khong hoat dong",
    className: "bg-slate-500/10 text-slate-700",
  },
  suspended: {
    label: "Tam khoa",
    className: "bg-rose-500/10 text-rose-700",
  },
};

const roleConfig: Record<UserRole, { label: string; className: string }> = {
  admin: {
    label: "Admin",
    className: "bg-amber-500/10 text-amber-700",
  },
  user: {
    label: "User",
    className: "bg-sky-500/10 text-sky-700",
  },
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const metricCards: Array<{
  key: keyof AdminUserStats;
  label: string;
  icon: typeof Users;
}> = [
  { key: "friendsCount", label: "Ban be", icon: Users },
  {
    key: "directConversationsCount",
    label: "Cuoc tro chuyen direct",
    icon: MessageSquare,
  },
  {
    key: "groupConversationsCount",
    label: "Nhom chat",
    icon: Users,
  },
  { key: "messagesCount", label: "Tin nhan", icon: MessageSquare },
  { key: "blockingCount", label: "Dang chan", icon: Slash },
  { key: "blockedByCount", label: "Bi chan", icon: Shield },
];

const AdminUserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState<AdminUserDetailData | null>(null);
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserDetail = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);
      setNotFound(false);

      const response = await axiosInstance.get(`/admin/users/${userId}`);
      setUser(response.data.data.user);
      setStats(response.data.data.stats);
    } catch (err: any) {
      const statusCode = err?.response?.status;
      const message =
        err?.response?.data?.message ?? "Khong the tai thong tin nguoi dung.";

      if (statusCode === 404) {
        setNotFound(true);
        setUser(null);
        setStats(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    void fetchUserDetail(id);
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/users")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">User Detail</h1>
            <p className="text-sm text-muted-foreground">Khong tim thay nguoi dung.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 text-center">
          <p className="text-base font-medium text-foreground">User khong ton tai hoac da bi xoa.</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate("/admin/users")}>
            Quay lai danh sach user
          </Button>
        </div>
      </div>
    );
  }

  if (error || !user || !stats) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/users")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">User Detail</h1>
            <p className="text-sm text-muted-foreground">Khong the tai du lieu chi tiet.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6">
          <p className="text-sm font-medium text-rose-700">{error ?? "Da xay ra loi khong xac dinh."}</p>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => navigate("/admin/users")}>
              Ve danh sach
            </Button>
            <Button onClick={() => id && void fetchUserDetail(id)}>Thu lai</Button>
          </div>
        </div>
      </div>
    );
  }

  const currentStatus = statusConfig[user.status] ?? statusConfig.active;
  const currentRole = roleConfig[user.role] ?? roleConfig.user;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/users")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">User Detail</h1>
            <p className="text-sm text-muted-foreground">
              Xem thong tin co ban va thong ke nhanh cua tai khoan.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_340px]">
        <section className="space-y-6">
          <div className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-sm">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-4">
                <UserAvatar
                  type="chat"
                  name={user.displayName}
                  avatarUrl={user.avatar ?? undefined}
                  className="size-20"
                />
                <div className="space-y-2">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">{user.displayName}</h2>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${currentStatus.className}`}
                    >
                      {currentStatus.label}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${currentRole.className}`}
                    >
                      {currentRole.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  User ID
                </p>
                <p className="mt-2 break-all font-mono text-xs text-foreground">{user._id}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 border-t border-border/60 pt-6 md:grid-cols-2">
              <div className="rounded-xl bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      Email
                    </p>
                    <p className="mt-1 break-all text-sm text-foreground">{user.email}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      Created At
                    </p>
                    <p className="mt-1 text-sm text-foreground">{formatDateTime(user.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground">Thong ke nhanh</h3>
              <p className="text-sm text-muted-foreground">
                Cac so lieu tong quan de admin danh gia muc do hoat dong cua user.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {metricCards.map((metric) => {
                const Icon = metric.icon;

                return (
                  <div
                    key={metric.key}
                    className="rounded-xl border border-border/60 bg-muted/30 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">{metric.label}</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">
                          {stats[metric.key]}
                        </p>
                      </div>
                      <div className="rounded-lg bg-background/80 p-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground">Admin Actions</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Khu vuc de san cho ban, unban, xoa tai khoan hoac cap role sau nay.
            </p>

            <div className="mt-5 space-y-3">
              <Button variant="outline" className="w-full justify-start" disabled>
                Ban user
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled>
                Unban user
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled>
                Cap / go role admin
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive"
                disabled
              >
                Xoa tai khoan
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5">
            <p className="text-sm font-medium text-foreground">Goi y mo rong</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Action panel da tach rieng khoi khu vuc thong tin, nen sau nay co the gan
              dialog, mutation hook va audit log ma khong can sua lai layout tong the.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AdminUserDetail;
