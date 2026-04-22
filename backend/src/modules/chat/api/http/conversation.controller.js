import {
  addGroupMembersCommand,
  createConversationCommand,
  deleteOrLeaveConversationCommand,
  emitDirectBlockStatusChanged,
  markConversationSeenCommand,
  removeGroupMemberCommand,
  updateGroupNameCommand,
  uploadGroupAvatarCommand,
} from "../../application/conversation.command-service.js";
import {
  getConversationListForUser,
  getConversationMessagesForUser,
  getGroupDetailsForUser,
  getUserConversationIdsForRealtime,
} from "../../application/conversation.query-service.js";

export const createConversation = async (req, res) => {
  try {
    const result = await createConversationCommand({
      user: req.user,
      body: req.body,
    });

    if (result.error) {
      return res.status(result.error.status).json({
        ...(result.error.code ? { code: result.error.code } : {}),
        message: result.error.message,
      });
    }

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi khi tao conversation", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const getConversation = async (req, res) => {
  try {
    const conversations = await getConversationListForUser(req.user);
    return res.status(200).json({ conversations });
  } catch (error) {
    console.error("Loi xay ra khi lay conversations", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const result = await getConversationMessagesForUser({
      user: req.user,
      conversationId: req.params.conversationId,
      limit: req.query.limit,
      cursor: req.query.cursor,
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    return res.status(200).json(result.payload);
  } catch (error) {
    console.error("Loi xay ra khi lay messages", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const getUserConversationsForSocketIO = async (userId) =>
  getUserConversationIdsForRealtime(userId);

export const markasSeen = async (req, res) => {
  try {
    const result = await markConversationSeenCommand({
      conversationId: req.params.conversationId,
      userId: req.user._id,
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi khi mark as seen", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const deleteOrLeaveGroupConversation = async (req, res) => {
  try {
    const result = await deleteOrLeaveConversationCommand({
      user: req.user,
      conversationId: req.params.conversationId,
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi deleteOrLeaveGroupConversation:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const addGroupMembers = async (req, res) => {
  try {
    const result = await addGroupMembersCommand({
      user: req.user,
      conversationId: req.params.conversationId,
      memberIds: req.body.memberIds,
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi addGroupMembers:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const removeGroupMember = async (req, res) => {
  try {
    const result = await removeGroupMemberCommand({
      user: req.user,
      conversationId: req.params.conversationId,
      memberId: req.body.memberId,
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi removeGroupMember:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const uploadGroupAvatar = async (req, res) => {
  try {
    const result = await uploadGroupAvatarCommand({
      user: req.user,
      conversationId: req.params.conversationId,
      file: req.file,
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi uploadGroupAvatar:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const updateGroupName = async (req, res) => {
  try {
    const result = await updateGroupNameCommand({
      user: req.user,
      conversationId: req.params.conversationId,
      name: req.body.name,
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi updateGroupName:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export { emitDirectBlockStatusChanged };

export const getGroupDetails = async (req, res) => {
  try {
    const result = await getGroupDetailsForUser({
      user: req.user,
      conversationId: req.params.conversationId,
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    return res.status(200).json(result.payload);
  } catch (error) {
    console.error("Loi getGroupDetails:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};
