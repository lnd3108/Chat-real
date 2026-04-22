import {
  deleteSupportConversation,
  getCurrentSupportConversation,
  getOrCreateSupportConversation,
  getSupportConversationDetail,
  getUserSupportConversations,
  sendSupportMessage,
} from "./support.controller.js";
import { protectedRoute } from "../../../identity/api/http/auth.middleware.js";
import { createRouteModule, defineRoute } from "../../../../shared/api/http/route-adapter.js";

export default createRouteModule({
  routerMiddlewares: [protectedRoute],
  routes: [
    defineRoute("post", "/conversations", getOrCreateSupportConversation),
    defineRoute("get", "/conversations/me/current", getCurrentSupportConversation),
    defineRoute("get", "/conversations/me", getUserSupportConversations),
    defineRoute("get", "/conversations/:id", getSupportConversationDetail),
    defineRoute("delete", "/conversations/:id", deleteSupportConversation),
    defineRoute("post", "/messages", sendSupportMessage),
  ],
});
