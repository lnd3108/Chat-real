import { Badge } from "@/shared/ui/badge";
import { getRoleBadgeClassName, getRoleLabel, type AppRole } from "@/shared/lib/rbac";

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
