import type { ReactNode } from "react";

import { hasAnyPermission, hasPermission, type AppPermission } from "@/lib/rbac";
import { useAuthStore } from "@/stores/useAuthStore";

interface PermissionGuardProps {
  permission?: AppPermission;
  anyPermissions?: AppPermission[];
  fallback?: ReactNode;
  children: ReactNode;
}

const PermissionGuard = ({
  permission,
  anyPermissions,
  fallback = null,
  children,
}: PermissionGuardProps) => {
  const user = useAuthStore((state) => state.user);

  const allowed = permission
    ? hasPermission(user, permission)
    : anyPermissions
      ? hasAnyPermission(user, anyPermissions)
      : true;

  return allowed ? <>{children}</> : <>{fallback}</>;
};

export default PermissionGuard;
