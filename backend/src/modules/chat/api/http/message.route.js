import {
  deleteMessageForEveryone,
  deleteMessageForMe,
  editMessage,
  sendDirectMessage,
  sendGroupMessage,
  sendMessageWithImage,
  toggleReaction,
} from "./message.controller.js";
import { protectedRoute } from "../../../identity/api/http/auth.middleware.js";
import { createRouteModule, defineRoute } from "../../../../shared/api/http/route-adapter.js";
import {
  uploadSingleImage,
  validateBody,
} from "../../../../shared/api/http/request-middleware-adapters.js";
import {
  checkFriendship,
  checkGroupMemberShip,
} from "../../../../middlewares/friendMiddleware.js";
import {
  sendDirectMessageSchema,
  sendGroupMessageSchema,
} from "../../../../libs/validation.js";

// khai báo lỗi chung và route
export default createRouteModule({
  routerMiddlewares: [protectedRoute],
  routes: [
    defineRoute(
      "post",
      "/direct",
      checkFriendship,
      validateBody(sendDirectMessageSchema),
      sendDirectMessage,
    ),
    defineRoute(
      "post",
      "/direct/with-image",
      uploadSingleImage("image"),
      checkFriendship,
      sendDirectMessage,
    ),
    defineRoute(
      "post",
      "/group",
      checkGroupMemberShip,
      validateBody(sendGroupMessageSchema),
      sendGroupMessage,
    ),
    defineRoute(
      "post",
      "/group/with-image",
      uploadSingleImage("image"),
      checkGroupMemberShip,
      sendGroupMessage,
    ),
    defineRoute(
      "post",
      "/legacy/group/with-image",
      uploadSingleImage("image"),
      checkGroupMemberShip,
      sendMessageWithImage,
    ),
    defineRoute("patch", "/:messageId", editMessage),
    defineRoute("delete", "/:messageId/me", deleteMessageForMe),
    defineRoute("delete", "/:messageId/everyone", deleteMessageForEveryone),
    defineRoute("post", "/:messageId/reactions", toggleReaction),
  ],
});
