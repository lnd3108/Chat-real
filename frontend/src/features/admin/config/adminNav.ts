import {
  Ban,
  Flag,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  MessageSquare,
  ScrollText,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  APP_PERMISSIONS,
  hasPermission,
  type AppPermission,
} from "@/shared/lib/rbac";

type AdminAccessUser = Parameters<typeof hasPermission>[0];

export interface AdminNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  permission: AppPermission;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    id: "dashboard",
    label: "Tổng quan",
    icon: LayoutDashboard,
    path: "/admin/dashboard",
    permission: APP_PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    id: "users",
    label: "Người dùng",
    icon: Users,
    path: "/admin/users",
    permission: APP_PERMISSIONS.USER_VIEW,
  },
  {
    id: "audit-logs",
    label: "Lịch sử quyền",
    icon: ScrollText,
    path: "/admin/audit-logs",
    permission: APP_PERMISSIONS.AUDIT_LOG_VIEW,
  },
  {
    id: "blocks",
    label: "Khối chặn",
    icon: Ban,
    path: "/admin/blocks",
    permission: APP_PERMISSIONS.USER_VIEW,
  },
  {
    id: "friends",
    label: "Bạn bè",
    icon: Heart,
    path: "/admin/friends",
    permission: APP_PERMISSIONS.USER_VIEW,
  },
  {
    id: "friend-requests",
    label: "Lời mời kết bạn",
    icon: Mail,
    path: "/admin/friend-requests",
    permission: APP_PERMISSIONS.USER_VIEW,
  },
  {
    id: "conversations",
    label: "Cuộc trò chuyện",
    icon: MessageSquare,
    path: "/admin/conversations",
    permission: APP_PERMISSIONS.USER_VIEW,
  },
  {
    id: "support",
    label: "Hỗ trợ",
    icon: LifeBuoy,
    path: "/admin/support",
    permission: APP_PERMISSIONS.SUPPORT_VIEW,
  },
  {
    id: "reports",
    label: "Báo cáo",
    icon: Flag,
    path: "/admin/reports",
    permission: APP_PERMISSIONS.REPORT_VIEW,
  },
  {
    id: "maintenance",
    label: "Bảo trì",
    icon: Zap,
    path: "/admin/maintenance",
    permission: APP_PERMISSIONS.MAINTENANCE_TOGGLE,
  },
];

export const getAllowedAdminNavItems = (user: AdminAccessUser) =>
  ADMIN_NAV_ITEMS.filter((item) => hasPermission(user, item.permission));

export const getFirstAllowedAdminPath = (user: AdminAccessUser) =>
  getAllowedAdminNavItems(user)[0]?.path ?? "/admin";

export const getAdminNavItemForPath = (pathname: string) =>
  ADMIN_NAV_ITEMS.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );

export const canAccessAdminPath = (user: AdminAccessUser, pathname: string) => {
  const item = getAdminNavItemForPath(pathname);
  return item ? hasPermission(user, item.permission) : false;
};
