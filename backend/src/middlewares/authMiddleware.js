// Đây là file middleware để bảo vệ các route cần xác thực và phân quyền
export {
  protectedRoute,
  requireAdmin,
  requireAnyPermission,
  requirePermission,
} from "../modules/identity/api/http/auth.middleware.js";
