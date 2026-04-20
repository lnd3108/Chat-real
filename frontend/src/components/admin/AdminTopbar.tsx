import { useAuthStore } from "@/stores/useAuthStore";
import UserAvatar from "../chat/UserAvatar";
import { Bell, Search } from "lucide-react";
import { Input } from "../ui/input";

const AdminTopbar = () => {
  const { user } = useAuthStore();

  return (
    <header className="border-b border-border/50 bg-card/50 px-6 py-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="max-w-md flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm kiếm..."
              className="border-border/50 bg-muted/50 pl-10 focus:border-primary/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="relative rounded-lg p-2 transition-colors hover:bg-muted/50">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
          </button>

          <div className="flex items-center gap-3 border-l border-border/50 pl-4">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">
                {user?.displayName || "Admin"}
              </p>
              <p className="text-xs text-muted-foreground">
                {user?.role === "admin" ? "Quản trị viên" : "Người dùng"}
              </p>
            </div>
            <UserAvatar
              type="chat"
              name={user?.displayName || "A"}
              avatarUrl={user?.avatarUrl}
              className="size-8"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default AdminTopbar;
