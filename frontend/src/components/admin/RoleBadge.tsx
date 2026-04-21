import { Badge } from "@/components/ui/badge";
import { getPrimaryRole, getRoleBadgeClassName, getRoleLabel, type AppRole } from "@/lib/rbac";

interface RoleBadgeProps {
  role?: AppRole;
  roles?: AppRole[];
  className?: string;
}

const RoleBadge = ({ role, roles, className }: RoleBadgeProps) => {
  const resolvedRole = role ?? getPrimaryRole({ roles });

  return (
    <Badge
      variant="outline"
      className={`${getRoleBadgeClassName(resolvedRole)} ${className ?? ""}`.trim()}
    >
      {getRoleLabel(resolvedRole)}
    </Badge>
  );
};

export default RoleBadge;
