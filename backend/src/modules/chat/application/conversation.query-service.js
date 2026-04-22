import Conversation from "../../../models/Conversation.js";

export const getUserConversationIdsForRealtime = async (userId) => {
  try {
    const conversations = await Conversation.find(
      {
        "participants.userId": userId,
        $or: [
          { type: { $ne: "support" } },
          { type: "support", userDeletedAt: null },
        ],
      },
      { _id: 1 },
    );

    return conversations.map((conversation) => conversation._id.toString());
  } catch (error) {
    console.error("Loi khi fetch conversations realtime:", error);
    return [];
  }
};
