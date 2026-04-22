import {
  acceptFriendRequest,
  cancelSentFriendRequest,
  declineFriendRequest,
  getAllFriends,
  getFriendRequests,
  removeFriend,
  sendFriendRequest,
} from "./friend.controller.js";
import { protectedRoute } from "../../../identity/api/http/auth.middleware.js";
import { createRouteModule, defineRoute } from "../../../../shared/api/http/route-adapter.js";

export default createRouteModule({
  routerMiddlewares: [protectedRoute],
  routes: [
    defineRoute("post", "/requests", sendFriendRequest),
    defineRoute("post", "/requests/:requestId/accept", acceptFriendRequest),
    defineRoute("post", "/requests/:requestId/decline", declineFriendRequest),
    defineRoute("delete", "/requests/:requestId", cancelSentFriendRequest),
    defineRoute("delete", "/:targetUserId", removeFriend),
    defineRoute("get", "/", getAllFriends),
    defineRoute("get", "/requests", getFriendRequests),
  ],
});
