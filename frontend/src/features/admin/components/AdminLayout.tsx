import { Outlet } from "react-router";
import AdminSidebar from "@/features/admin/components/AdminSidebar";
import AdminTopbar from "@/features/admin/components/AdminTopbar";
import { useAdminSocket } from "@/features/admin/hooks/useAdminSocket";

const AdminLayout = () => {
  useAdminSocket();

  return (
    <div className="app-shell-bg flex h-dvh min-h-0 overflow-hidden">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <AdminTopbar />

        {/* Content */}
        <main className="app-scrollbar min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
