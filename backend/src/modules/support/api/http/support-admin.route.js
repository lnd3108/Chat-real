import { APP_PERMISSIONS } from "../../../../constants/rbac.js";
import {
  requireAnyPermission,
  requirePermission,
  protectedRoute,
} from "../../../identity/api/http/auth.middleware.js";
import {
  assignSupportAdmin,
  getSupportConversationDetail,
  getSupportConversations,
  sendSupportReply,
  updateSupportStatus,
} from "./support-admin.controller.js";
import { createRouteModule, defineRoute } from "../../../../shared/api/http/route-adapter.js";

export default createRouteModule({
  routerMiddlewares: [
    protectedRoute,
    requireAnyPermission([
      APP_PERMISSIONS.SUPPORT_VIEW,
      APP_PERMISSIONS.SUPPORT_REPLY,
    ]),
  ],
  routes: [
    defineRoute(
      "get",
      "/conversations",
      requirePermission(APP_PERMISSIONS.SUPPORT_VIEW),
      getSupportConversations,
    ),
    defineRoute(
      "get",
      "/conversations/:id",
      requirePermission(APP_PERMISSIONS.SUPPORT_VIEW),
      getSupportConversationDetail,
    ),
    defineRoute(
      "post",
      "/messages",
      requirePermission(APP_PERMISSIONS.SUPPORT_REPLY),
      sendSupportReply,
    ),
    defineRoute(
      "patch",
      "/conversations/:id/status",
      requirePermission(APP_PERMISSIONS.SUPPORT_REPLY),
      updateSupportStatus,
    ),
    defineRoute(
      "patch",
      "/conversations/:id/assign",
      requirePermission(APP_PERMISSIONS.SUPPORT_REPLY),
      assignSupportAdmin,
    ),
  ],
});
