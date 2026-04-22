import {
  createReport,
  getMyReports,
} from "./report.controller.js";
import { protectedRoute } from "../../../identity/api/http/auth.middleware.js";
import { createRouteModule, defineRoute } from "../../../../shared/api/http/route-adapter.js";

export default createRouteModule({
  routerMiddlewares: [protectedRoute],
  routes: [
    defineRoute("post", "/", createReport),
    defineRoute("get", "/me", getMyReports),
  ],
});
