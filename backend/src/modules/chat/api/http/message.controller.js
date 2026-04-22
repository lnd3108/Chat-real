import {
  deleteMessageForEveryoneCommand,
  deleteMessageForMeCommand,
  editMessageCommand,
  sendDirectMessageCommand,
  sendGroupMessageCommand,
  toggleMessageReactionCommand,
} from "../../application/message.command-service.js";

const sendCommandResult = (res, result) => {
  if (result?.error) {
    return res.status(result.error.status).json({
      message: result.error.message,
      code: result.error.code,
    });
  }

  return res.status(result.status).json(result.payload);
};

export const sendDirectMessage = async (req, res) => {
  try {
    return sendCommandResult(
      res,
      await sendDirectMessageCommand({
        user: req.user,
        body: req.body,
        file: req.file,
      }),
    );
  } catch (error) {
    console.error("Lá»—i xáº£y ra khi gá»­i tin nháº¯n trá»±c tiáº¿p", error);
    return res.status(500).json({ message: "Lá»—i há»‡ thá»‘ng" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    return sendCommandResult(
      res,
      await sendGroupMessageCommand({
        user: req.user,
        conversation: req.conversation,
        body: req.body,
        file: req.file,
      }),
    );
  } catch (error) {
    console.error("Lá»—i xáº£y ra khi gá»­i tin nháº¯n nhÃ³m", error);
    return res.status(500).json({ message: "Lá»—i há»‡ thá»‘ng" });
  }
};

export const editMessage = async (req, res) => {
  try {
    return sendCommandResult(
      res,
      await editMessageCommand({
        user: req.user,
        messageId: req.params.messageId,
        content: req.body?.content,
      }),
    );
  } catch (error) {
    console.error("Lá»—i khi sá»­a tin nháº¯n", error);
    return res.status(500).json({ message: "Lá»—i há»‡ thá»‘ng" });
  }
};

export const deleteMessageForMe = async (req, res) => {
  try {
    return sendCommandResult(
      res,
      await deleteMessageForMeCommand({
        user: req.user,
        messageId: req.params.messageId,
      }),
    );
  } catch (error) {
    console.error("Lá»—i khi xÃ³a tin nháº¯n á»Ÿ phÃ­a mÃ¬nh", error);
    return res.status(500).json({ message: "Lá»—i há»‡ thá»‘ng" });
  }
};

export const deleteMessageForEveryone = async (req, res) => {
  try {
    return sendCommandResult(
      res,
      await deleteMessageForEveryoneCommand({
        user: req.user,
        messageId: req.params.messageId,
      }),
    );
  } catch (error) {
    console.error("Lá»—i khi thu há»“i tin nháº¯n cho táº¥t cáº£", error);
    return res.status(500).json({ message: "Lá»—i há»‡ thá»‘ng" });
  }
};

export const toggleReaction = async (req, res) => {
  try {
    return sendCommandResult(
      res,
      await toggleMessageReactionCommand({
        user: req.user,
        messageId: req.params.messageId,
        emoji: req.body?.emoji,
      }),
    );
  } catch (error) {
    console.error("Lá»—i khi tháº£ biá»ƒu cáº£m vÃ o tin nháº¯n", error);
    return res.status(500).json({ message: "Lá»—i há»‡ thá»‘ng" });
  }
};

export const sendMessageWithImage = sendGroupMessage;
