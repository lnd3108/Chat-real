import {
  assignSupportAdminCommand,
  getSupportConversationDetailQuery,
  getSupportConversationsQuery,
  sendSupportReplyCommand,
  updateSupportStatusCommand,
} from "../../application/support-admin.service.js";

const getErrorStatus = (error) => error?.status || 500;
const getErrorMessage = (error, fallback) => error?.message || fallback;

export const getSupportConversations = async (req, res) => {
  try {
    const data = await getSupportConversationsQuery(req.query);

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

export const getSupportConversationDetail = async (req, res) => {
  try {
    const data = await getSupportConversationDetailQuery({
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

export const sendSupportReply = async (req, res) => {
  try {
    const data = await sendSupportReplyCommand({
      admin: req.user,
      conversationId: req.body.conversationId,
      content: req.body.content,
    });

    return res.status(201).json({
      message: "Gá»­i pháº£n há»“i há»— trá»£ thÃ nh cÃ´ng",
      data,
    });
  } catch (error) {
    console.error("Lá»—i khi gá»­i pháº£n há»“i há»— trá»£:", error);
    return res.status(getErrorStatus(error)).json({
      message: getErrorMessage(error, "KhÃ´ng thá»ƒ gá»­i pháº£n há»“i há»— trá»£"),
    });
  }
};

export const updateSupportStatus = async (req, res) => {
  try {
    const conversation = await updateSupportStatusCommand({
      admin: req.user,
      conversationId: req.params.id,
      status: req.body.status,
    });

    return res.json({
      message: "Cáº­p nháº­t tráº¡ng thÃ¡i há»— trá»£ thÃ nh cÃ´ng",
      data: { conversation },
    });
  } catch (error) {
    console.error("Lá»—i khi cáº­p nháº­t tráº¡ng thÃ¡i há»— trá»£:", error);
    return res.status(getErrorStatus(error)).json({
      message: getErrorMessage(error, "KhÃ´ng thá»ƒ cáº­p nháº­t tráº¡ng thÃ¡i há»— trá»£"),
    });
  }
};

export const assignSupportAdmin = async (req, res) => {
  try {
    const conversation = await assignSupportAdminCommand({
      conversationId: req.params.id,
      adminId: req.body.adminId,
    });

    return res.json({
      message: "GÃ¡n quáº£n trá»‹ viÃªn thÃ nh cÃ´ng",
      data: { conversation },
    });
  } catch (error) {
    console.error("Lá»—i khi gÃ¡n quáº£n trá»‹ viÃªn há»— trá»£:", error);
    return res.status(getErrorStatus(error)).json({
      message: getErrorMessage(error, "KhÃ´ng thá»ƒ gÃ¡n quáº£n trá»‹ viÃªn"),
    });
  }
};
