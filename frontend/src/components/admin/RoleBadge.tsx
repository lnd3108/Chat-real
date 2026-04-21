import { Badge } from "@/components/ui/badge";
import { getRoleBadgeClassName, getRoleLabel, type AppRole } from "@/lib/rbac";

interface RoleBadgeProps {
  role: AppRole;
  className?: string;
}

const RoleBadge = ({ role, className }: RoleBadgeProps) => {
  return (
    <Badge
      variant="outline"
      className={`${getRoleBadgeClassName(role)} ${className ?? ""}`.trim()}
    >
      {getRoleLabel(role)}
    </Badge>
  );
};

export default RoleBadge;
