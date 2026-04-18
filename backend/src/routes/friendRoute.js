import express from "express";

import {
  acceptFriendRequest,
  cancelSentFriendRequest,
  sendFriendRequest,
  declineFriendRequest,
  getAllFriends,
  getFriendRequests,
} from "../controllers/friendController.js";

const router = express.Router();

router.post("/requests", sendFriendRequest);

router.post("/requests/:requestId/accept", acceptFriendRequest);

router.post("/requests/:requestId/decline", declineFriendRequest);

router.delete("/requests/:requestId", cancelSentFriendRequest);

router.get("/", getAllFriends);

router.get("/requests", getFriendRequests);

export default router;
