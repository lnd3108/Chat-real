import {
  acceptFriendRequestCommand,
  cancelSentFriendRequestCommand,
  declineFriendRequestCommand,
  getAllFriendsQuery,
  getFriendRequestsQuery,
  removeFriendCommand,
  sendFriendRequestCommand,
} from "../../application/friendship.service.js";

export const sendFriendRequest = async (req, res) => {
  try {
    const result = await sendFriendRequestCommand({ user: req.user, body: req.body });
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi khi gui yeu cau ket ban", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const acceptFriendRequest = async (req, res) => {
  try {
    const result = await acceptFriendRequestCommand({
      user: req.user,
      requestId: req.params.requestId,
    });
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi khi chap nhan yeu cau ket ban", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const declineFriendRequest = async (req, res) => {
  try {
    const result = await declineFriendRequestCommand({
      user: req.user,
      requestId: req.params.requestId,
    });
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    if (result.status === 204) {
      return res.sendStatus(204);
    }
    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi khi tu choi yeu cau ket ban", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const cancelSentFriendRequest = async (req, res) => {
  try {
    const result = await cancelSentFriendRequestCommand({
      user: req.user,
      requestId: req.params.requestId,
    });
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi khi huy yeu cau ket ban", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const getAllFriends = async (req, res) => {
  try {
    return res.status(200).json(await getAllFriendsQuery({ user: req.user }));
  } catch (error) {
    console.error("Loi khi lay danh sach ban be", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const getFriendRequests = async (req, res) => {
  try {
    return res.status(200).json(await getFriendRequestsQuery({ user: req.user }));
  } catch (error) {
    console.error("Loi khi lay danh sach yeu cau ket ban", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const removeFriend = async (req, res) => {
  try {
    const result = await removeFriendCommand({
      user: req.user,
      targetUserId: req.params.targetUserId,
    });
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi khi huy ket ban", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};
