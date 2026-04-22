import {
  deleteSupportConversationForUser,
  getOrCreateSupportConversationForUser,
  getSupportConversationDetailForUser,
  getUserSupportConversationsQuery,
  sendSupportMessageCommand,
} from "../../application/support-user.service.js";

const getErrorStatus = (error) => error?.status || 500;
const getErrorMessage = (error, fallback) => error?.message || fallback;

export const getOrCreateSupportConversation = async (req, res) => {
  try {
    const conversation = await getOrCreateSupportConversationForUser({
      user: req.user,
    });

    return res.json({
      message: "Láº¥y cuá»™c trÃ² chuyá»‡n há»— trá»£ thÃ nh cÃ´ng",
      data: { conversation },
    });
  } catch (error) {
    console.error("Lá»—i khi láº¥y hoáº·c táº¡o cuá»™c trÃ² chuyá»‡n há»— trá»£:", error);
    return res.status(getErrorStatus(error)).json({
      message: getErrorMessage(error, "KhÃ´ng thá»ƒ láº¥y cuá»™c trÃ² chuyá»‡n há»— trá»£"),
    });
  }
};

export const getCurrentSupportConversation = getOrCreateSupportConversation;

export const getUserSupportConversations = async (req, res) => {
  try {
    const data = await getUserSupportConversationsQuery({
      userId: req.user._id,
      page: req.query.page,
      limit: req.query.limit,
      sort: req.query.sort || "updatedAt-desc",
    });

    return res.json({
      message: "Láº¥y danh sÃ¡ch cuá»™c trÃ² chuyá»‡n há»— trá»£ thÃ nh cÃ´ng",
      data,
    });
  } catch (error) {
    console.error("Lá»—i khi láº¥y danh sÃ¡ch cuá»™c trÃ² chuyá»‡n há»— trá»£:", error);
    return res.status(getErrorStatus(error)).json({
      message: getErrorMessage(error, "KhÃ´ng thá»ƒ láº¥y danh sÃ¡ch cuá»™c trÃ² chuyá»‡n há»— trá»£"),
    });
  }
};

export const sendSupportMessage = async (req, res) => {
  try {
    const data = await sendSupportMessageCommand({
      user: req.user,
      conversationId: req.body.conversationId,
      content: req.body.content,
    });

    return res.status(201).json({
      message: "Gá»­i tin nháº¯n há»— trá»£ thÃ nh cÃ´ng",
      data,
    });
  } catch (error) {
    console.error("Lá»—i khi gá»­i tin nháº¯n há»— trá»£:", error);
    return res.status(getErrorStatus(error)).json({
      message: getErrorMessage(error, "KhÃ´ng thá»ƒ gá»­i tin nháº¯n"),
    });
  }
};

export const getSupportConversationDetail = async (req, res) => {
  try {
    const data = await getSupportConversationDetailForUser({
      userId: req.user._id,
      conversationId: req.params.id,
    });

    return res.json({
      message: "Láº¥y chi tiáº¿t cuá»™c trÃ² chuyá»‡n há»— trá»£ thÃ nh cÃ´ng",
      data,
    });
  } catch (error) {
    console.error("Lá»—i khi láº¥y chi tiáº¿t cuá»™c trÃ² chuyá»‡n há»— trá»£:", error);
    return res.status(getErrorStatus(error)).json({
      message: getErrorMessage(error, "KhÃ´ng thá»ƒ láº¥y chi tiáº¿t cuá»™c trÃ² chuyá»‡n há»— trá»£"),
    });
  }
};

export const deleteSupportConversation = async (req, res) => {
  try {
    const data = await deleteSupportConversationForUser({
      userId: req.user._id,
      conversationId: req.params.id,
    });

    return res.json({
      message: "XÃ³a cuá»™c trÃ² chuyá»‡n há»— trá»£ thÃ nh cÃ´ng",
      data,
    });
  } catch (error) {
    console.error("Lá»—i khi xÃ³a cuá»™c trÃ² chuyá»‡n há»— trá»£:", error);
    return res.status(getErrorStatus(error)).json({
      message: getErrorMessage(error, "KhÃ´ng thá»ƒ xÃ³a cuá»™c trÃ² chuyá»‡n há»— trá»£"),
    });
  }
};
