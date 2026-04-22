import {
  addGroupMembers,
  createConversation,
  deleteOrLeaveGroupConversation,
  getConversation,
  getGroupDetails,
  getMessages,
  markasSeen,
  removeGroupMember,
  updateGroupName,
  uploadGroupAvatar,
} from "./conversation.controller.js";
import { protectedRoute } from "../../../identity/api/http/auth.middleware.js";
import { createRouteModule, defineRoute } from "../../../../shared/api/http/route-adapter.js";
import {
  uploadSingleFile,
  validateBody,
} from "../../../../shared/api/http/request-middleware-adapters.js";
import { checkFriendship } from "../../../../middlewares/friendMiddleware.js";
import {
  addGroupMemberSchema,
  createConversationSchema,
  removeGroupMemberSchema,
} from "../../../../libs/validation.js";

export default createRouteModule({
  routerMiddlewares: [protectedRoute],
  routes: [
    defineRoute(
      "post",
      "/",
      checkFriendship,
      validateBody(createConversationSchema),
      createConversation,
    ),
    defineRoute("get", "/", getConversation),
    defineRoute("get", "/:conversationId/messages", getMessages),
    defineRoute("get", "/:conversationId/details", getGroupDetails),
    defineRoute(
      "post",
      "/:conversationId/avatar",
      uploadSingleFile("file"),
      uploadGroupAvatar,
    ),
    defineRoute("patch", "/:conversationId/name", updateGroupName),
    defineRoute("patch", "/:conversationId/seen", markasSeen),
    defineRoute(
      "patch",
      "/:conversationId/members/add",
      validateBody(addGroupMemberSchema),
      addGroupMembers,
    ),
    defineRoute(
      "patch",
      "/:conversationId/members/remove",
      validateBody(removeGroupMemberSchema),
      removeGroupMember,
    ),
    defineRoute("delete", "/:conversationId", deleteOrLeaveGroupConversation),
  ],
});
