import express from "express";

import {
  acceptFriendRequest,
  cancelSentFriendRequest,
  declineFriendRequest,
  getAllFriends,
  getFriendRequests,
  removeFriend,
  sendFriendRequest,
} from "../modules/friendship/api/http/friend.controller.js";

const router = express.Router();

router.post("/requests", sendFriendRequest);

router.post("/requests/:requestId/accept", acceptFriendRequest);

router.post("/requests/:requestId/decline", declineFriendRequest);

router.delete("/requests/:requestId", cancelSentFriendRequest);
router.delete("/:targetUserId", removeFriend);

router.get("/", getAllFriends);

router.get("/requests", getFriendRequests);

export default router;
