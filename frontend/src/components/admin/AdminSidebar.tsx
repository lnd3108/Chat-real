import { useState } from "react";
import { NavLink } from "react-router";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Flag,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Mail,
  MessageSquare,
  Users,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";

const AdminSidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { signOut } = useAuthStore();

  const menuItems = [
    {
      id: "dashboard",
      label: "Tổng quan",
      icon: LayoutDashboard,
      path: "/admin/dashboard",
    },
    {
      id: "users",
      label: "Người dùng",
      icon: Users,
      path: "/admin/users",
    },
    {
      id: "blocks",
      label: "Khối chặn",
      icon: Ban,
      path: "/admin/blocks",
    },
    {
      id: "friends",
      label: "Bạn bè",
      icon: Heart,
      path: "/admin/friends",
    },
    {
      id: "friend-requests",
      label: "Lời mời kết bạn",
      icon: Mail,
      path: "/admin/friend-requests",
    },
    {
      id: "conversations",
      label: "Cuộc trò chuyện",
      icon: MessageSquare,
      path: "/admin/conversations",
    },
    {
      id: "support",
      label: "Hỗ trợ",
      icon: LifeBuoy,
      path: "/admin/support",
    },
    {
      id: "reports",
      label: "Báo cáo",
      icon: Flag,
      path: "/admin/reports",
    },
    {
      id: "maintenance",
      label: "Bảo Trì",
      icon: Zap,
      path: "/admin/maintenance",
    },
  ];

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/signin";
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-64",
      )}
    >
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-6">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-chat font-bold text-white">
              A
            </div>
            <span className="text-lg font-bold">Admin</span>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="rounded-lg p-2 transition-colors hover:bg-muted/50"
          title={isCollapsed ? "Mở rộng" : "Thu gọn"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-6">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )
              }
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-border/50 px-3 py-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title={isCollapsed ? "Đăng xuất" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>Đăng xuất</span>}
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
