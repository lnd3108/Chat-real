import AdminAuditLogs from "@/features/admin/pages/AdminAuditLogs";
import AdminBlocks from "@/features/admin/pages/AdminBlocks";
import AdminConversations from "@/features/admin/pages/AdminConversations";
import AdminDashboard from "@/features/admin/pages/AdminDashboard";
import AdminFriendRequests from "@/features/admin/pages/AdminFriendRequests";
import AdminFriends from "@/features/admin/pages/AdminFriends";
import AdminMaintenance from "@/features/admin/pages/AdminMaintenance";
import AdminReportDetail from "@/features/admin/pages/AdminReportDetail";
import AdminReports from "@/features/admin/pages/AdminReports";
import AdminSupport from "@/features/admin/pages/AdminSupport";
import AdminSupportDetail from "@/features/admin/pages/AdminSupportDetail";
import AdminUserDetail from "@/features/admin/pages/AdminUserDetail";
import AdminUsers from "@/features/admin/pages/AdminUsers";
import { APP_PERMISSIONS, type AppPermission } from "@/shared/lib/rbac";
import { hasPermission } from "@/shared/lib/rbac";
import type { ReactElement } from "react";

export interface AdminRouteItem {
  path: string;
  element: ReactElement;
  permission: AppPermission;
}

export const ADMIN_ROUTES: AdminRouteItem[] = [
  {
    path: "/admin/dashboard",
    element: <AdminDashboard />,
    permission: APP_PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    path: "/admin/users",
    element: <AdminUsers />,
    permission: APP_PERMISSIONS.USER_VIEW,
  },
  {
    path: "/admin/audit-logs",
    element: <AdminAuditLogs />,
    permission: APP_PERMISSIONS.AUDIT_LOG_VIEW,
  },
  {
    path: "/admin/users/:id",
    element: <AdminUserDetail />,
    permission: APP_PERMISSIONS.USER_VIEW,
  },
  {
    path: "/admin/blocks",
    element: <AdminBlocks />,
    permission: APP_PERMISSIONS.USER_VIEW,
  },
  {
    path: "/admin/friends",
    element: <AdminFriends />,
    permission: APP_PERMISSIONS.USER_VIEW,
  },
  {
    path: "/admin/friend-requests",
    element: <AdminFriendRequests />,
    permission: APP_PERMISSIONS.USER_VIEW,
  },
  {
    path: "/admin/conversations",
    element: <AdminConversations />,
    permission: APP_PERMISSIONS.USER_VIEW,
  },
  {
    path: "/admin/support",
    element: <AdminSupport />,
    permission: APP_PERMISSIONS.SUPPORT_VIEW,
  },
  {
    path: "/admin/support/:id",
    element: <AdminSupportDetail />,
    permission: APP_PERMISSIONS.SUPPORT_VIEW,
  },
  {
    path: "/admin/reports",
    element: <AdminReports />,
    permission: APP_PERMISSIONS.REPORT_VIEW,
  },
  {
    path: "/admin/reports/:id",
    element: <AdminReportDetail />,
    permission: APP_PERMISSIONS.REPORT_VIEW,
  },
  {
    path: "/admin/maintenance",
    element: <AdminMaintenance />,
    permission: APP_PERMISSIONS.MAINTENANCE_TOGGLE,
  },
];

type AdminAccessUser = Parameters<typeof hasPermission>[0];

const routePatternToRegExp = (path: string) =>
  new RegExp(`^${path.replace(/:[^/]+/g, "[^/]+")}$`);

export const getAdminRouteForPath = (pathname: string) =>
  ADMIN_ROUTES.find((route) => routePatternToRegExp(route.path).test(pathname));

export const canAccessAdminRoute = (user: AdminAccessUser, pathname: string) => {
  const route = getAdminRouteForPath(pathname);
  return route ? hasPermission(user, route.permission) : false;
};
