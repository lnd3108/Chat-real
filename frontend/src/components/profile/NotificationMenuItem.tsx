import { Bell } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

type Props = {
  count?: number;
  onClick?: () => void;
};

const NotificationMenuItem = ({ count = 0, onClick }: Props) => {
  return (
    <DropdownMenuItem onClick={onClick}>
      <div className="relative">
        <Bell className="text-muted-foreground dark:group-focus:!text-accent-foreground" />

        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 text-[10px] rounded-full bg-destructive text-white flex items-center justify-center">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </div>

      Thông Báo
    </DropdownMenuItem>
  );
};

export default NotificationMenuItem;
