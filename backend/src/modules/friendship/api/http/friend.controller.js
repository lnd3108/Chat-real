import {
  acceptFriendRequestCommand,
  cancelSentFriendRequestCommand,
  declineFriendRequestCommand,
  getAllFriendsQuery,
  getFriendRequestsQuery,
  removeFriendCommand,
  sendFriendRequestCommand,
} from "../../application/friendship.service.js";
import { makeCommandHandler, makeQueryHandler } from "../../../../shared/api/http/controller-factory.js";
import { makeServerErrorHandler } from "../../../../shared/api/http/error-handlers.js";
import {
  presentCommandResult,
  presentJson,
} from "../../../../shared/api/http/presenters.js";

const friendshipServerError = makeServerErrorHandler({
  logMessage: "Friendship controller error",
  message: "Lỗi hệ thống",
});

export const sendFriendRequest = makeCommandHandler({
  execute: (req) => sendFriendRequestCommand({ user: req.user, body: req.body }),
  present: presentCommandResult,
  onError: friendshipServerError,
});

export const acceptFriendRequest = makeCommandHandler({
  execute: (req) =>
    acceptFriendRequestCommand({
      user: req.user,
      requestId: req.params.requestId,
    }),
  present: presentCommandResult,
  onError: friendshipServerError,
});

export const declineFriendRequest = makeCommandHandler({
  execute: (req) =>
    declineFriendRequestCommand({
      user: req.user,
      requestId: req.params.requestId,
    }),
  present: presentCommandResult,
  onError: friendshipServerError,
});

export const cancelSentFriendRequest = makeCommandHandler({
  execute: (req) =>
    cancelSentFriendRequestCommand({
      user: req.user,
      requestId: req.params.requestId,
    }),
  present: presentCommandResult,
  onError: friendshipServerError,
});

export const getAllFriends = makeQueryHandler({
  execute: (req) => getAllFriendsQuery({ user: req.user, query: req.query }),
  present: (data) => presentJson({ body: data }),
  onError: friendshipServerError,
});

export const getFriendRequests = makeQueryHandler({
  execute: (req) => getFriendRequestsQuery({ user: req.user, query: req.query }),
  present: (data) => presentJson({ body: data }),
  onError: friendshipServerError,
});

export const removeFriend = makeCommandHandler({
  execute: (req) =>
    removeFriendCommand({
      user: req.user,
      targetUserId: req.params.targetUserId,
    }),
  present: presentCommandResult,
  onError: friendshipServerError,
});
